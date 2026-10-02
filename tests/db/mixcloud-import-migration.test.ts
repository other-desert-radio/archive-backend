import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import {
	down,
	up,
} from "../../src/db/migrations/0018_create_mixcloud_import_table.js";
import {
	up as addMetadata,
	down as removeMetadata,
} from "../../src/db/migrations/0019_add_mixcloud_source_metadata.js";
import type { Database } from "../../src/db/types.js";

// Opt in with a disposable database URL; never fall back to DATABASE_URL.
const databaseUrl = process.env.MIXCLOUD_MIGRATION_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"Mixcloud migration integrity, deletion, and rollback",
	async () => {
		const schema = `mixcloud_migration_${crypto.randomUUID().replaceAll("-", "")}`;
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({
					connectionString: databaseUrl,
					options: `-c search_path=${schema}`,
				}),
			}),
		});
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(db);
			await createShows(db);
			await up(db);
			await db
				.insertInto("mixcloud_import")
				.values({ key: "/existing/" })
				.execute();
			await addMetadata(db);
			const sourceMetadata = {
				url: "https://www.mixcloud.com/example/show/",
				name: "Source cloudcast",
				created_time: new Date("2026-01-01T12:00:00Z"),
				duration: 3600,
				image_small: "https://example.test/small.jpg",
				image_large: "https://example.test/large.jpg",
			};
			const existing = await db
				.selectFrom("mixcloud_import")
				.selectAll()
				.where("key", "=", "/existing/")
				.executeTakeFirstOrThrow();
			for (const column of Object.keys(
				sourceMetadata,
			) as (keyof typeof sourceMetadata)[]) {
				expect(existing[column]).toBeNull();
			}
			await db
				.updateTable("mixcloud_import")
				.set(sourceMetadata)
				.where("id", "=", existing.id)
				.execute();
			const stored = await db
				.selectFrom("mixcloud_import")
				.selectAll()
				.where("id", "=", existing.id)
				.executeTakeFirstOrThrow();
			expect(stored).toEqual({ ...existing, ...sourceMetadata });
			await removeMetadata(db);
			const rolledBack = await sql<Record<string, unknown>>`
				SELECT * FROM mixcloud_import WHERE id = ${existing.id}
			`.execute(db);
			expect(rolledBack.rows[0]).toEqual({
				id: existing.id,
				createdAt: existing.createdAt,
				key: existing.key,
				show_id: null,
				imported_at: null,
			});
			await addMetadata(db);
			await db
				.deleteFrom("mixcloud_import")
				.where("id", "=", existing.id)
				.execute();
			const createShow = () =>
				db
					.insertInto("shows")
					.values({
						title: "Migration test",
						date: new Date("2026-01-01T00:00:00Z"),
						duration: 60,
						image: null,
						url: "https://example.test/show",
					})
					.returning("id")
					.executeTakeFirstOrThrow();
			const first = await createShow();
			const second = await createShow();
			const importedAt = new Date("2026-09-30T12:00:00Z");
			const pending = await db
				.insertInto("mixcloud_import")
				.values({ key: "/pending/" })
				.returningAll()
				.executeTakeFirstOrThrow();
			expect(pending.show_id).toBeNull();
			expect(pending.imported_at).toBeNull();
			expect(pending.createdAt).toBeInstanceOf(Date);
			await expect(
				db.insertInto("mixcloud_import").values({ key: "/pending/" }).execute(),
			).rejects.toThrow();
			await expect(
				sql`INSERT INTO mixcloud_import (key) VALUES (NULL)`.execute(db),
			).rejects.toThrow();
			await expect(
				db
					.insertInto("mixcloud_import")
					.values({ key: "/bad-show/", show_id: -1, imported_at: importedAt })
					.execute(),
			).rejects.toThrow();
			await expect(
				db
					.insertInto("mixcloud_import")
					.values({ key: "/missing-time/", show_id: first.id })
					.execute(),
			).rejects.toThrow();
			await expect(
				db
					.insertInto("mixcloud_import")
					.values({ key: "/missing-show/", imported_at: importedAt })
					.execute(),
			).rejects.toThrow();
			await db
				.insertInto("mixcloud_import")
				.values([
					{ key: "/first/", show_id: first.id, imported_at: importedAt },
					{ key: "/second/", show_id: second.id, imported_at: importedAt },
					{ key: "/remove/", show_id: second.id, imported_at: importedAt },
				])
				.execute();
			await db
				.deleteFrom("mixcloud_import")
				.where("key", "=", "/remove/")
				.execute();
			expect(await db.selectFrom("shows").select("id").execute()).toHaveLength(
				2,
			);
			await expect(
				db
					.updateTable("mixcloud_import")
					.set({ imported_at: null })
					.where("key", "=", "/first/")
					.execute(),
			).rejects.toThrow();
			await db
				.updateTable("mixcloud_import")
				.set({ show_id: null })
				.where("key", "=", "/first/")
				.execute();
			expect(
				(
					await db
						.selectFrom("mixcloud_import")
						.selectAll()
						.where("key", "=", "/first/")
						.executeTakeFirstOrThrow()
				).imported_at,
			).toBeNull();
			await db
				.updateTable("mixcloud_import")
				.set({ show_id: first.id, imported_at: importedAt })
				.where("key", "=", "/first/")
				.execute();
			const beforeDelete = await db
				.selectFrom("mixcloud_import")
				.selectAll()
				.where("key", "=", "/first/")
				.executeTakeFirstOrThrow();
			await db.deleteFrom("shows").where("id", "=", first.id).execute();
			expect(
				await db
					.selectFrom("mixcloud_import")
					.selectAll()
					.where("key", "=", "/first/")
					.executeTakeFirstOrThrow(),
			).toEqual({ ...beforeDelete, show_id: null, imported_at: null });
			expect(
				(
					await db
						.selectFrom("mixcloud_import")
						.selectAll()
						.where("key", "=", "/second/")
						.executeTakeFirstOrThrow()
				).imported_at,
			).toEqual(importedAt);
			await db.deleteFrom("shows").execute();
			const remaining = await db
				.selectFrom("mixcloud_import")
				.selectAll()
				.execute();
			expect(remaining).toHaveLength(3);
			expect(
				remaining.every(
					(row) => row.show_id === null && row.imported_at === null,
				),
			).toBe(true);
			const survivor = await createShow();
			await down(db);
			expect(await db.selectFrom("shows").select("id").execute()).toEqual([
				survivor,
			]);
			const objects = await sql<{
				table_name: string | null;
				function_name: string | null;
			}>`
			SELECT to_regclass('mixcloud_import')::text AS table_name,
			to_regprocedure('mixcloud_import_clear_imported_at()')::text AS function_name
		`.execute(db);
			expect(objects.rows[0]).toEqual({
				table_name: null,
				function_name: null,
			});
			await up(db);
			await down(db);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
