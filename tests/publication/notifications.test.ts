import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import Fastify from "fastify";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { adminRoutes } from "../../src/admin/admin.js";
import { up as createJobs } from "../../src/db/migrations/0030_add_archive_publication_jobs.js";
import { up as createLogs } from "../../src/db/migrations/0031_add_archive_publication_logs.js";
import {
	up as createNotifications,
	down as dropNotifications,
} from "../../src/db/migrations/0032_notify_publication_jobs.js";
import { up as publicationModes } from "../../src/db/migrations/0033_add_publication_modes.js";
import type { Database } from "../../src/db/types.js";
import { createPublicationNotifications } from "../../src/publication/notifications.js";

const client = () =>
	Object.assign(new EventEmitter(), {
		queries: [] as string[],
		released: false,
		async query(statement: string) {
			this.queries.push(statement);
		},
		release() {
			this.released = true;
		},
	});
describe("publication notifications", () => {
	test("LISTEN prompts durable reads and unsubscribe stops delivery", async () => {
		const connection = client();
		const notifications = await createPublicationNotifications({
			connect: async () => connection,
		} as never);
		let reads = 0;
		const unsubscribe = notifications.subscribe(
			() => {
				reads++;
			},
			() => {},
		);
		expect(connection.queries).toEqual(["LISTEN archive_publication_changed"]);
		connection.emit("notification", { channel: "other" });
		connection.emit("notification", {
			channel: "archive_publication_changed",
			payload: "untrusted hint",
		});
		expect(reads).toBe(1);
		unsubscribe();
		connection.emit("notification", { channel: "archive_publication_changed" });
		expect(reads).toBe(1);
		await notifications.close();
		expect(connection.released).toBe(true);
		expect(connection.queries.at(-1)).toBe(
			"UNLISTEN archive_publication_changed",
		);
	});
	test("connection recovery notifies subscribers to reread durable state", async () => {
		const first = client(),
			second = client();
		let connections = 0;
		const notifications = await createPublicationNotifications({
			connect: async () => (++connections === 1 ? first : second),
		} as never);
		let reads = 0,
			errors = 0;
		notifications.subscribe(
			() => {
				reads++;
			},
			() => {
				errors++;
			},
		);
		first.emit("error", new Error("disconnected"));
		expect(errors).toBe(1);
		expect(first.released).toBe(true);
		await Bun.sleep(1100);
		expect(connections).toBe(2);
		expect(reads).toBe(1);
		second.emit("notification", { channel: "archive_publication_changed" });
		expect(reads).toBe(2);
		await notifications.close();
	});
	test("close cancels a pending connection retry", async () => {
		let attempts = 0;
		const notifications = await createPublicationNotifications({
			connect: async () => {
				attempts++;
				throw new Error("offline");
			},
		} as never);
		await notifications.close();
		await Bun.sleep(1100);
		expect(attempts).toBe(1);
	});
});

const databaseUrl = process.env.PUBLICATION_STORE_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"real PostgreSQL notifications honor transactions and SSE reconnects to durable job/log state",
	async () => {
		const schema = `publication_notify_${crypto.randomUUID().replaceAll("-", "")}`;
		const pool = new Pool({
			connectionString: databaseUrl,
			options: `-c search_path=${schema}`,
		});
		const database = new Kysely<Database>({
			dialect: new PostgresDialect({ pool }),
		});
		let notifications:
			| Awaited<ReturnType<typeof createPublicationNotifications>>
			| undefined;
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(database);
			await createJobs(database);
			await createLogs(database);
			await createNotifications(database);
			notifications = await createPublicationNotifications(pool);
			let changes = 0;
			notifications.subscribe(
				() => {
					changes++;
				},
				(error) => {
					throw error;
				},
			);
			const values = {
				id: crypto.randomUUID(),
				requested_by: "admin",
				repository: "local",
				checkout_path: "/tmp/archive",
				branch: "publish-dev",
				retry_job_id: null,
				completed_at: null,
				revision: null,
				commit_id: null,
				error: null,
			};
			await database.transaction().execute(async (transaction) => {
				await transaction
					.insertInto("archive_publication_jobs")
					.values(values)
					.execute();
				await Bun.sleep(40);
				expect(changes).toBe(0);
			});
			await waitFor(() => changes === 1);
			await expect(
				database.transaction().execute(async (transaction) => {
					await transaction
						.updateTable("archive_publication_jobs")
						.set({ stage: "validating" })
						.execute();
					throw new Error("rollback");
				}),
			).rejects.toThrow("rollback");
			await Bun.sleep(80);
			expect(changes).toBe(1);
			await database
				.insertInto("archive_publication_logs")
				.values({ job_id: values.id, sequence: 1, message: "safe progress" })
				.execute();
			await waitFor(() => changes === 2);
			await database
				.updateTable("archive_publication_jobs")
				.set({
					outcome: "failed",
					completed_at: new Date(),
					error: "failed safely",
				})
				.execute();
			await waitFor(() => changes === 3);
			await dropNotifications(database);
			await database
				.updateTable("archive_publication_jobs")
				.set({ error: "notifications disabled" })
				.execute();
			await Bun.sleep(80);
			expect(changes).toBe(3);
			await createNotifications(database);
			await database.deleteFrom("archive_publication_jobs").execute();
			await waitFor(() => changes === 4);
			expect(
				await database
					.selectFrom("archive_publication_logs")
					.selectAll()
					.execute(),
			).toEqual([]);
			await sql`CREATE TABLE archive_publication_state (id integer, revision bigint, published_revision bigint)`.execute(
				database,
			);
			await sql`INSERT INTO archive_publication_state VALUES (1, 9, 3)`.execute(
				database,
			);
			const app = Fastify();
			await database.transaction().execute(publicationModes);
			const config = {
				mode: "remote" as const,
				repository: values.repository,
				checkoutPath: values.checkout_path,
				branch: values.branch,
			};
			await app.register(
				adminRoutes(
					{
						api: {
							getSession: async () => ({
								user: { id: "admin", role: "admin" },
							}),
						},
					} as never,
					database,
					{
						config,
						notifications,
						runner: {
							start: async () => {
								throw new Error("Not invoked");
							},
							close: async () => {},
						},
					},
				),
			);
			const address = await app.listen({ host: "127.0.0.1", port: 0 });
			const controller = new AbortController();
			try {
				const response = await fetch(
					`${address}/api/admin/publication/events`,
					{ signal: controller.signal },
				);
				const reader = response.body?.getReader();
				if (reader === undefined) throw new Error("Missing event stream");
				const first = new TextDecoder().decode((await reader.read()).value);
				expect(first).toContain('"revision":"9"');
				expect(first).toContain('"pending":true');
				await database
					.insertInto("archive_publication_jobs")
					.values(values)
					.execute();
				await database
					.insertInto("archive_publication_logs")
					.values({
						job_id: values.id,
						sequence: 1,
						message: "Live progress from PostgreSQL",
					})
					.execute();
				let frames = "";
				while (!frames.includes("Live progress from PostgreSQL")) {
					const chunk = await reader.read();
					if (chunk.done)
						throw new Error("Event stream closed before log update");
					frames += new TextDecoder().decode(chunk.value);
				}
				expect(frames).toContain('"type":"job"');
				expect(frames).toContain(values.id);
				controller.abort();
				const reconnect = new AbortController();
				try {
					const resumed = await fetch(
						`${address}/api/admin/publication/events`,
						{ signal: reconnect.signal },
					);
					const resumedReader = resumed.body?.getReader();
					let restored = "";
					while (!restored.includes("Live progress from PostgreSQL")) {
						const chunk = await resumedReader?.read();
						if (chunk === undefined || chunk.done)
							throw new Error("Reconnect did not restore logs");
						restored += new TextDecoder().decode(chunk.value);
					}
					expect(restored).toContain(values.id);
				} finally {
					reconnect.abort();
				}
			} finally {
				controller.abort();
				await app.close();
			}
		} finally {
			await notifications?.close();
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(
				database,
			);
			await database.destroy();
		}
	},
);

const waitFor = async (ready: () => boolean) => {
	const deadline = Date.now() + 3000;
	while (!ready()) {
		if (Date.now() > deadline)
			throw new Error("Timed out waiting for PostgreSQL notification");
		await Bun.sleep(10);
	}
};
