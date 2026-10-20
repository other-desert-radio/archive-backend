import type { Pool } from "pg";
/** Notifications prompt durable-state reads; reconnect must also prompt a read. */
export type PublicationNotifications = {
	subscribe: (
		onChange: () => void,
		onError: (error: unknown) => void,
	) => () => void;
	close: () => Promise<void>;
};

export const createPublicationNotifications = (
	_pool: Pool,
): Promise<PublicationNotifications> => {
	throw new Error("Not implemented: createPublicationNotifications");
};
