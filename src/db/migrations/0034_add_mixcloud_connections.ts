import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("mixcloud_connections")
		.addColumn("user_id", "text", (c) =>
			c.primaryKey().references("user.id").onDelete("cascade"),
		)
		.addColumn("mixcloud_key", "text", (c) => c.notNull())
		.addColumn("display_name", "text", (c) => c.notNull())
		.addColumn("access_token_encrypted", "text", (c) => c.notNull())
		.addColumn("createdAt", "timestamptz", (c) =>
			c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamptz", (c) =>
			c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addCheckConstraint(
			"mixcloud_connection_key_valid",
			sql`mixcloud_key ~ '^/[A-Za-z0-9_-]+/$'`,
		)
		.addCheckConstraint(
			"mixcloud_connection_name_nonempty",
			sql`length(btrim(display_name)) > 0`,
		)
		.addCheckConstraint(
			"mixcloud_connection_token_nonempty",
			sql`length(btrim(access_token_encrypted)) > 0`,
		)
		.execute();
	// Composite reference prevents binding an attempt to another user's session.
	await db.schema
		.createIndex("session_mixcloud_owner_unique")
		.on("session")
		.columns(["id", "userId"])
		.unique()
		.execute();
	await db.schema
		.createTable("mixcloud_oauth_attempts")
		.addColumn("state_hash", "text", (c) => c.primaryKey())
		.addColumn("user_id", "text", (c) => c.notNull())
		.addColumn("session_id", "text", (c) => c.notNull())
		.addColumn("createdAt", "timestamptz", (c) =>
			c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("expires_at", "timestamptz", (c) => c.notNull())
		.addForeignKeyConstraint(
			"mixcloud_attempt_session_owner",
			["session_id", "user_id"],
			"session",
			["id", "userId"],
			(c) => c.onDelete("cascade"),
		)
		.addCheckConstraint(
			"mixcloud_attempt_hash_valid",
			sql`state_hash ~ '^[0-9a-f]{64}$'`,
		)
		.addCheckConstraint(
			"mixcloud_attempt_expiry_valid",
			sql`expires_at > "createdAt" AND expires_at <= "createdAt" + interval '10 minutes'`,
		)
		.execute();
	await db.schema
		.createIndex("mixcloud_attempt_user_idx")
		.on("mixcloud_oauth_attempts")
		.column("user_id")
		.execute();
	await db.schema
		.createIndex("mixcloud_attempt_session_idx")
		.on("mixcloud_oauth_attempts")
		.column("session_id")
		.execute();
	await db.schema
		.createIndex("mixcloud_attempt_expiry_idx")
		.on("mixcloud_oauth_attempts")
		.column("expires_at")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("mixcloud_oauth_attempts").execute();
	await db.schema.dropIndex("session_mixcloud_owner_unique").execute();
	await db.schema.dropTable("mixcloud_connections").execute();
}
