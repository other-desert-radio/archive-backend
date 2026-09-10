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

const databaseUrl =
	process.env.DATABASE_URL ??
	(process.env.POSTGRES_DB &&
	process.env.POSTGRES_USER &&
	process.env.POSTGRES_PASSWORD
		? `postgres://${encodeURIComponent(process.env.POSTGRES_USER)}:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@${process.env.POSTGRES_HOST ?? "localhost"}:${process.env.POSTGRES_PORT ?? "5432"}/${encodeURIComponent(process.env.POSTGRES_DB)}`
		: undefined);

if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL or POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD are required",
	);
}

const pool = new Pool({ connectionString: databaseUrl });

export const db = new Kysely<Database>({
	dialect: new PostgresDialect({ pool }),
});
