import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../types.js";

/** Extend the installed Better Auth schema and preserve existing administrator access. */
export async function up(db: Kysely<Database>): Promise<void> {
	// Unique index creation fails transactionally on pre-existing normalized collisions.
	await sql`create unique index user_normalized_email_unique on "user" (lower(btrim(email)))`.execute(
		db,
	);
	await sql`update "user" set email = lower(btrim(email)), role = coalesce(role, 'admin')`.execute(
		db,
	);
	await sql`alter table "user"
  alter column role set default 'editor', alter column role set not null,
  add constraint user_role_valid check (role in ('admin', 'editor')),
  add constraint user_email_normalized check (email = lower(btrim(email))),
  add column "mustChangePassword" boolean not null default false,
  add column banned boolean not null default false,
  add column "banReason" text,
  add column "banExpires" timestamptz`.execute(db);
	await db.schema
		.alterTable("session")
		.addColumn("impersonatedBy", "text")
		.execute();
	await db.schema
		.createTable("rateLimit")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("key", "text", (c) => c.notNull().unique())
		.addColumn("count", "integer", (c) => c.notNull())
		.addColumn("lastRequest", "bigint", (c) => c.notNull())
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("rateLimit").execute();
	await db.schema.alterTable("session").dropColumn("impersonatedBy").execute();
	await sql`alter table "user"
  drop constraint user_role_valid, drop constraint user_email_normalized,
  alter column role drop default, alter column role drop not null,
  drop column "mustChangePassword", drop column banned, drop column "banReason", drop column "banExpires"`.execute(
		db,
	);
	await sql`drop index user_normalized_email_unique`.execute(db);
}
