import { type Generated, Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

export interface DjsTable {
	id: Generated<number>;
	title: string;
	bio: string;
	image: string | undefined;
}

export interface Database {
	djs: DjsTable;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: databaseUrl });

export const db = new Kysely<Database>({
	dialect: new PostgresDialect({ pool }),
});
