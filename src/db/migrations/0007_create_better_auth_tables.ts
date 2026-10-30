/*
 * user (new table)
 * ┌─────────────────┬─────────────┬─────────────────────────────────────┐
 * │ Column / change │ Type        │ Constraints / purpose               │
 * ├─────────────────┼─────────────┼─────────────────────────────────────┤
 * │ id              │ text        │ PRIMARY KEY                         │
 * │ name            │ text        │ NOT NULL                            │
 * │ email           │ text        │ NOT NULL; UNIQUE                    │
 * │ emailVerified   │ boolean     │ NOT NULL                            │
 * │ image           │ text        │ Nullable                            │
 * │ createdAt       │ timestamptz │ NOT NULL; DEFAULT CURRENT_TIMESTAMP │
 * │ updatedAt       │ timestamptz │ NOT NULL; DEFAULT CURRENT_TIMESTAMP │
 * └─────────────────┴─────────────┴─────────────────────────────────────┘
 *
 * session (new table)
 * ┌─────────────────┬─────────────┬────────────────────────────────────────┐
 * │ Column / change │ Type        │ Constraints / purpose                  │
 * ├─────────────────┼─────────────┼────────────────────────────────────────┤
 * │ id              │ text        │ PRIMARY KEY                            │
 * │ expiresAt       │ timestamptz │ NOT NULL                               │
 * │ token           │ text        │ NOT NULL; UNIQUE                       │
 * │ createdAt       │ timestamptz │ NOT NULL; DEFAULT CURRENT_TIMESTAMP    │
 * │ updatedAt       │ timestamptz │ NOT NULL                               │
 * │ ipAddress       │ text        │ Nullable                               │
 * │ userAgent       │ text        │ Nullable                               │
 * │ userId          │ text        │ NOT NULL; FK user.id ON DELETE CASCADE │
 * └─────────────────┴─────────────┴────────────────────────────────────────┘
 *
 * account (new table)
 * ┌───────────────────────┬─────────────┬────────────────────────────────────────┐
 * │ Column / change       │ Type        │ Constraints / purpose                  │
 * ├───────────────────────┼─────────────┼────────────────────────────────────────┤
 * │ id                    │ text        │ PRIMARY KEY                            │
 * │ accountId             │ text        │ NOT NULL                               │
 * │ providerId            │ text        │ NOT NULL                               │
 * │ userId                │ text        │ NOT NULL; FK user.id ON DELETE CASCADE │
 * │ accessToken           │ text        │ Nullable                               │
 * │ refreshToken          │ text        │ Nullable                               │
 * │ idToken               │ text        │ Nullable                               │
 * │ accessTokenExpiresAt  │ timestamptz │ Nullable                               │
 * │ refreshTokenExpiresAt │ timestamptz │ Nullable                               │
 * │ scope                 │ text        │ Nullable                               │
 * │ password              │ text        │ Nullable                               │
 * │ createdAt             │ timestamptz │ NOT NULL; DEFAULT CURRENT_TIMESTAMP    │
 * │ updatedAt             │ timestamptz │ NOT NULL                               │
 * └───────────────────────┴─────────────┴────────────────────────────────────────┘
 *
 * verification (new table)
 * ┌─────────────────┬─────────────┬─────────────────────────────────────┐
 * │ Column / change │ Type        │ Constraints / purpose               │
 * ├─────────────────┼─────────────┼─────────────────────────────────────┤
 * │ id              │ text        │ PRIMARY KEY                         │
 * │ identifier      │ text        │ NOT NULL                            │
 * │ value           │ text        │ NOT NULL                            │
 * │ expiresAt       │ timestamptz │ NOT NULL                            │
 * │ createdAt       │ timestamptz │ NOT NULL; DEFAULT CURRENT_TIMESTAMP │
 * │ updatedAt       │ timestamptz │ NOT NULL; DEFAULT CURRENT_TIMESTAMP │
 * └─────────────────┴─────────────┴─────────────────────────────────────┘
 */
import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../types.js";

/*
 * Better Auth schema generated in docs/BETTER_AUTH_SCHEMA.sql and transcribed
 * here so it follows the repository's reviewed Kysely migration workflow.
 */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("user")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("name", "text", (c) => c.notNull())
		.addColumn("email", "text", (c) => c.notNull().unique())
		.addColumn("emailVerified", "boolean", (c) => c.notNull())
		.addColumn("image", "text")
		.addColumn("createdAt", "timestamptz", (c) =>
			c.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.addColumn("updatedAt", "timestamptz", (c) =>
			c.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.execute();

	await db.schema
		.createTable("session")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("expiresAt", "timestamptz", (c) => c.notNull())
		.addColumn("token", "text", (c) => c.notNull().unique())
		.addColumn("createdAt", "timestamptz", (c) =>
			c.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.addColumn("updatedAt", "timestamptz", (c) => c.notNull())
		.addColumn("ipAddress", "text")
		.addColumn("userAgent", "text")
		.addColumn("userId", "text", (c) =>
			c.notNull().references("user.id").onDelete("cascade"),
		)
		.execute();
	await db.schema
		.createIndex("session_userId_idx")
		.on("session")
		.column("userId")
		.execute();

	await db.schema
		.createTable("account")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("accountId", "text", (c) => c.notNull())
		.addColumn("providerId", "text", (c) => c.notNull())
		.addColumn("userId", "text", (c) =>
			c.notNull().references("user.id").onDelete("cascade"),
		)
		.addColumn("accessToken", "text")
		.addColumn("refreshToken", "text")
		.addColumn("idToken", "text")
		.addColumn("accessTokenExpiresAt", "timestamptz")
		.addColumn("refreshTokenExpiresAt", "timestamptz")
		.addColumn("scope", "text")
		.addColumn("password", "text")
		.addColumn("createdAt", "timestamptz", (c) =>
			c.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.addColumn("updatedAt", "timestamptz", (c) => c.notNull())
		.execute();
	await db.schema
		.createIndex("account_userId_idx")
		.on("account")
		.column("userId")
		.execute();

	await db.schema
		.createTable("verification")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("identifier", "text", (c) => c.notNull())
		.addColumn("value", "text", (c) => c.notNull())
		.addColumn("expiresAt", "timestamptz", (c) => c.notNull())
		.addColumn("createdAt", "timestamptz", (c) =>
			c.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.addColumn("updatedAt", "timestamptz", (c) =>
			c.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
		)
		.execute();
	await db.schema
		.createIndex("verification_identifier_idx")
		.on("verification")
		.column("identifier")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("verification").execute();
	await db.schema.dropTable("account").execute();
	await db.schema.dropTable("session").execute();
	await db.schema.dropTable("user").execute();
}
