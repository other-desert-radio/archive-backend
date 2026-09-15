import type { Kysely } from "kysely";
import { db } from "./db.js";
import { dummyDJs } from "./dummy-djs.js";
import type { Database } from "./types.js";

export async function seedDJs(
	database: Kysely<Database> = db,
): Promise<number> {
	await database
		.insertInto("djs")
		.values(dummyDJs.map((dj) => ({ ...dj })))
		.execute();
	return dummyDJs.length;
}

if (import.meta.main) {
	try {
		const count = await seedDJs();
		console.log(`Inserted ${count} dummy DJs.`);
	} finally {
		await db.destroy();
	}
}
