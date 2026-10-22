import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createAuth } from "../../src/db/migrations/0007_create_better_auth_tables.js";
import {
	down,
	up,
} from "../../src/db/migrations/0034_add_mixcloud_connections.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_OAUTH_MIGRATION_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"Mixcloud connection and authorization-attempt schema, constraints, cascades and rollback",
	async () => {
		const schema = `mixcloud_oauth_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await sql`insert into "user" (id, name, email, "emailVerified") values ('u1', 'One', 'one@example.test', false), ('u2', 'Two', 'two@example.test', false)`.execute(
				db,
			);
			await sql`insert into session (id, token, "userId", "expiresAt", "updatedAt") values ('s1', 't1', 'u1', now() + interval '1 day', now()), ('s2', 't2', 'u2', now() + interval '1 day', now())`.execute(
				db,
			);
			await up(db);
			const connection = {
				user_id: "u1",
				mixcloud_key: "/station/",
				display_name: "Station",
				access_token_encrypted: "test-encrypted-envelope",
			};
			await db.insertInto("mixcloud_connections").values(connection).execute();
			await db
				.insertInto("mixcloud_connections")
				.values({ ...connection, user_id: "u2" })
				.execute();
			const saved = await db
				.selectFrom("mixcloud_connections")
				.selectAll()
				.where("user_id", "=", "u1")
				.executeTakeFirstOrThrow();
			expect(saved.createdAt).toBeInstanceOf(Date);
			expect(saved.updated_at).toBeInstanceOf(Date);
			await expect(
				db.insertInto("mixcloud_connections").values(connection).execute(),
			).rejects.toThrow();
			await expect(
				db
					.insertInto("mixcloud_connections")
					.values({ ...connection, user_id: "missing" })
					.execute(),
			).rejects.toThrow();
			for (const patch of [
				{ mixcloud_key: "/user/show/" },
				{ display_name: " " },
				{ access_token_encrypted: " " },
			])
				await expect(
					db
						.updateTable("mixcloud_connections")
						.set(patch)
						.where("user_id", "=", "u1")
						.execute(),
				).rejects.toThrow();
			const createdAt = new Date();
			const attempt = {
				state_hash: "a".repeat(64),
				user_id: "u1",
				session_id: "s1",
				createdAt,
				expires_at: new Date(createdAt.getTime() + 600_000),
			};
			await db.insertInto("mixcloud_oauth_attempts").values(attempt).execute();
			await expect(
				db.insertInto("mixcloud_oauth_attempts").values(attempt).execute(),
			).rejects.toThrow();
			for (const patch of [
				{ state_hash: "raw-state" },
				{ session_id: "s2" },
				{ session_id: "missing" },
				{ expires_at: createdAt },
				{ expires_at: new Date(createdAt.getTime() + 600_001) },
			])
				await expect(
					db
						.insertInto("mixcloud_oauth_attempts")
						.values({ ...attempt, state_hash: "b".repeat(64), ...patch })
						.execute(),
				).rejects.toThrow();
			await db.deleteFrom("session").where("id", "=", "s1").execute();
			expect(
				await db.selectFrom("mixcloud_oauth_attempts").selectAll().execute(),
			).toHaveLength(0);
			expect(
				await db.selectFrom("mixcloud_connections").selectAll().execute(),
			).toHaveLength(2);
			await db
				.insertInto("mixcloud_oauth_attempts")
				.values({ ...attempt, user_id: "u2", session_id: "s2" })
				.execute();
			await db.deleteFrom("user").where("id", "=", "u2").execute();
			expect(
				await db.selectFrom("mixcloud_oauth_attempts").selectAll().execute(),
			).toHaveLength(0);
			expect(
				await db.selectFrom("mixcloud_connections").selectAll().execute(),
			).toHaveLength(1);
			await down(db);
			const tables = await sql<{
				tablename: string;
			}>`select tablename from pg_tables where schemaname = ${schema} and tablename like 'mixcloud_%'`.execute(
				db,
			);
			expect(tables.rows).toHaveLength(0);
			expect(await db.selectFrom("user").select("id").execute()).toHaveLength(
				1,
			);
			await up(db);
			expect(
				await db.selectFrom("mixcloud_connections").selectAll().execute(),
			).toHaveLength(0);
		} finally {
			await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(db);
			await db.destroy();
		}
	},
);
