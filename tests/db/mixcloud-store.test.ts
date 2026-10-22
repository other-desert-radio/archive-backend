import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createAuth } from "../../src/db/migrations/0007_create_better_auth_tables.js";
import { up } from "../../src/db/migrations/0034_add_mixcloud_connections.js";
import type { Database } from "../../src/db/types.js";
import { createMixcloudStore } from "../../src/mixcloud/index.js";

const databaseUrl = process.env.MIXCLOUD_OAUTH_STORE_TEST_DATABASE_URL;
const key = Buffer.alloc(32, 23).toString("base64");
const owner = { userId: "u1", sessionId: "s1" };
const other = { userId: "u2", sessionId: "s2" };
const authorized = async () => ({
	identity: { key: "/station/", displayName: "Station" },
	accessToken: "private-token",
});
const hash = (state: string) =>
	createHash("sha256").update(state).digest("hex");

const withDatabase = async (run: (db: Kysely<Database>) => Promise<void>) => {
	const schema = `mixcloud_store_${crypto.randomUUID().replaceAll("-", "")}`;
	const db = new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: new Pool({
				connectionString: databaseUrl,
				options: `-c search_path=${schema}`,
			}),
		}),
	});
	try {
		await sql`create schema ${sql.id(schema)}`.execute(db);
		await createAuth(db);
		await up(db);
		await sql`insert into "user" (id, name, email, "emailVerified") values ('u1', 'One', 'one@example.test', false), ('u2', 'Two', 'two@example.test', false)`.execute(
			db,
		);
		await sql`insert into session (id, token, "userId", "expiresAt", "updatedAt") values ('s1', 't1', 'u1', now() + interval '1 day', now()), ('s2', 't2', 'u2', now() + interval '1 day', now())`.execute(
			db,
		);
		await run(db);
	} finally {
		await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(db);
		await db.destroy();
	}
};

test.skipIf(!databaseUrl)(
	"stores encrypted connections, replaces atomically, and isolates owners",
	() =>
		withDatabase(async (db) => {
			const store = createMixcloudStore(db, key);
			expect(await store.getConnection(owner.userId)).toBeUndefined();
			expect(await store.getAccessToken(owner.userId)).toBeUndefined();
			const state = await store.createAttempt(owner);
			const attempt = await db
				.selectFrom("mixcloud_oauth_attempts")
				.selectAll()
				.executeTakeFirstOrThrow();
			expect(attempt.state_hash).toBe(hash(state));
			expect(attempt.state_hash).not.toBe(state);
			expect(attempt.expires_at.getTime() - attempt.createdAt.getTime()).toBe(
				600_000,
			);
			expect(await store.completeAuthorization(owner, state, authorized)).toBe(
				true,
			);
			const first = await db
				.selectFrom("mixcloud_connections")
				.selectAll()
				.executeTakeFirstOrThrow();
			expect(first.access_token_encrypted).not.toContain("private-token");
			expect(
				await createMixcloudStore(db, key).getAccessToken(owner.userId),
			).toBe("private-token");
			expect(await store.getConnection(owner.userId)).toEqual({
				key: "/station/",
				displayName: "Station",
			});
			expect(await store.getConnection(other.userId)).toBeUndefined();
			const second = await store.createAttempt(owner);
			expect(
				await store.completeAuthorization(owner, second, async () => ({
					identity: { key: "/personal/", displayName: "Personal" },
					accessToken: "replacement-token",
				})),
			).toBe(true);
			const replacement = await db
				.selectFrom("mixcloud_connections")
				.selectAll()
				.executeTakeFirstOrThrow();
			expect(replacement.createdAt).toEqual(first.createdAt);
			expect(replacement.updated_at.getTime()).toBeGreaterThanOrEqual(
				first.updated_at.getTime(),
			);
			expect(await store.getAccessToken(owner.userId)).toBe(
				"replacement-token",
			);
			const otherState = await store.createAttempt(other);
			await store.completeAuthorization(other, otherState, authorized);
			await store.disconnect(owner.userId);
			expect(await store.getAccessToken(owner.userId)).toBeUndefined();
			expect(await store.getAccessToken(other.userId)).toBe("private-token");
		}),
);

test.skipIf(!databaseUrl)(
	"rejects wrong owners, wrong sessions, expired attempts and expired sessions",
	() =>
		withDatabase(async (db) => {
			const store = createMixcloudStore(db, key);
			let calls = 0;
			const authorize = async () => {
				calls++;
				return authorized();
			};
			const state = await store.createAttempt(owner);
			expect(await store.completeAuthorization(other, state, authorize)).toBe(
				false,
			);
			expect(
				await store.completeAuthorization(
					{ ...owner, sessionId: "s2" },
					state,
					authorize,
				),
			).toBe(false);
			await expect(
				store.createAttempt({ ...owner, sessionId: "s2" }),
			).rejects.toThrow("session is invalid");
			await db
				.updateTable("mixcloud_oauth_attempts")
				.set({
					createdAt: sql<Date>`CURRENT_TIMESTAMP - interval '11 minutes'`,
					expires_at: sql<Date>`CURRENT_TIMESTAMP - interval '1 minute'`,
				})
				.execute();
			expect(await store.completeAuthorization(owner, state, authorize)).toBe(
				false,
			);
			const expiredSessionState = await store.createAttempt(owner);
			await db
				.updateTable("session")
				.set({ expiresAt: new Date(0) })
				.where("id", "=", "s1")
				.execute();
			expect(
				await store.completeAuthorization(
					owner,
					expiredSessionState,
					authorize,
				),
			).toBe(false);
			await expect(store.createAttempt(owner)).rejects.toThrow(
				"session is invalid",
			);
			expect(calls).toBe(0);
		}),
);

test.skipIf(!databaseUrl)(
	"provider failure consumes attempt while preserving the previous connection",
	() =>
		withDatabase(async (db) => {
			const store = createMixcloudStore(db, key);
			await store.completeAuthorization(
				owner,
				await store.createAttempt(owner),
				authorized,
			);
			const state = await store.createAttempt(owner);
			await expect(
				store.completeAuthorization(owner, state, async () => {
					throw new Error("Provider rejected");
				}),
			).rejects.toThrow("Provider rejected");
			expect(await store.completeAuthorization(owner, state, authorized)).toBe(
				false,
			);
			expect(await store.getAccessToken(owner.userId)).toBe("private-token");
		}),
);

test.skipIf(!databaseUrl)(
	"concurrent callbacks consume an attempt once and disconnect wins over an in-flight callback",
	() =>
		withDatabase(async (db) => {
			const store = createMixcloudStore(db, key);
			const state = await store.createAttempt(owner);
			let calls = 0;
			const results = await Promise.all([
				store.completeAuthorization(owner, state, async () => {
					calls++;
					return authorized();
				}),
				store.completeAuthorization(owner, state, async () => {
					calls++;
					return authorized();
				}),
			]);
			expect(results.sort()).toEqual([false, true]);
			expect(calls).toBe(1);
			const nextState = await store.createAttempt(owner);
			let started: () => void = () => {};
			const ready = new Promise<void>((resolve) => {
				started = resolve;
			});
			let finish: () => void = () => {};
			const gate = new Promise<void>((resolve) => {
				finish = resolve;
			});
			const completing = store.completeAuthorization(
				owner,
				nextState,
				async () => {
					started();
					await gate;
					return authorized();
				},
			);
			await ready;
			const disconnecting = store.disconnect(owner.userId);
			finish();
			await completing;
			await disconnecting;
			expect(await store.getConnection(owner.userId)).toBeUndefined();
			expect(
				await store.completeAuthorization(owner, nextState, authorized),
			).toBe(false);
			const late = await store.createAttempt(owner);
			await store.disconnect(owner.userId);
			expect(await store.completeAuthorization(owner, late, authorized)).toBe(
				false,
			);
		}),
);

test.skipIf(!databaseUrl)(
	"logout cancels pending attempts while preserving connections; revocation during exchange prevents saving",
	() =>
		withDatabase(async (db) => {
			const store = createMixcloudStore(db, key);
			await store.completeAuthorization(
				owner,
				await store.createAttempt(owner),
				authorized,
			);
			const state = await store.createAttempt(owner);
			expect(
				await store.completeAuthorization(owner, state, async () => {
					await db
						.updateTable("session")
						.set({ expiresAt: new Date(0) })
						.where("id", "=", "s1")
						.execute();
					return {
						identity: { key: "/replacement/", displayName: "Replacement" },
						accessToken: "replacement",
					};
				}),
			).toBe(false);
			expect(await store.getAccessToken(owner.userId)).toBe("private-token");
			await db
				.updateTable("session")
				.set({ expiresAt: new Date(Date.now() + 60_000) })
				.where("id", "=", "s1")
				.execute();
			await store.createAttempt(owner);
			await db.deleteFrom("session").where("id", "=", "s1").execute();
			expect(await store.getAccessToken(owner.userId)).toBe("private-token");
			expect(
				await db.selectFrom("mixcloud_oauth_attempts").selectAll().execute(),
			).toHaveLength(0);
		}),
);
