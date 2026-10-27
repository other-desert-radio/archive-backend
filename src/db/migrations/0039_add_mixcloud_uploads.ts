import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/** Scaffold only: do not apply until the upload storage implementation is reviewed. */
export async function up(_db: Kysely<Database>): Promise<void> {
	throw new Error("Not implemented: create mixcloud_uploads");
}

export async function down(_db: Kysely<Database>): Promise<void> {
	throw new Error("Not implemented: drop mixcloud_uploads");
}
