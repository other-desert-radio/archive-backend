import type { Pool, PoolClient } from "pg";
/** Notifications are hints: every connection/reconnection prompts durable reads. */
export type PublicationNotifications = {
	subscribe: (
		onChange: () => void,
		onError: (error: unknown) => void,
	) => () => void;
	close: () => Promise<void>;
};

export const createPublicationNotifications = async (
	pool: Pool,
): Promise<PublicationNotifications> => {
	const subscribers = new Set<{
		change: () => void;
		error: (error: unknown) => void;
	}>();
	let client: PoolClient | undefined;
	let closed = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const changed = () => {
		for (const listener of subscribers) listener.change();
	};
	const failed = (error: unknown) => {
		for (const listener of subscribers) listener.error(error);
		const previous = client;
		client = undefined;
		previous?.removeAllListeners();
		previous?.release(true);
		if (!closed && timer === undefined)
			timer = setTimeout(() => {
				timer = undefined;
				void connect().catch(failed);
			}, 1000);
	};
	const connect = async () => {
		const connection = await pool.connect();
		if (closed) {
			connection.release();
			return;
		}
		client = connection;
		connection.on("error", failed);
		connection.on("end", () =>
			failed(new Error("Publication notification connection ended")),
		);
		connection.on("notification", (notification) => {
			if (notification.channel === "archive_publication_changed") changed();
		});
		await connection.query("LISTEN archive_publication_changed");
		changed();
	};
	await connect().catch(failed);
	return {
		subscribe: (change, error) => {
			const listener = { change, error };
			subscribers.add(listener);
			return () => {
				subscribers.delete(listener);
			};
		},
		close: async () => {
			closed = true;
			if (timer !== undefined) clearTimeout(timer);
			subscribers.clear();
			const connection = client;
			client = undefined;
			if (connection !== undefined) {
				connection.removeAllListeners();
				try {
					await connection.query("UNLISTEN archive_publication_changed");
				} finally {
					connection.release();
				}
			}
		},
	};
};
