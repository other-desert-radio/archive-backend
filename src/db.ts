import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

export type Database = Record<string, never>;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: databaseUrl });

export const db = new Kysely<Database>({
	dialect: new PostgresDialect({ pool }),
});
