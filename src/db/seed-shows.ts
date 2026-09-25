import type { Kysely } from "kysely";
import type { Database } from "./types.js";

export const dummyShows = [
	{
		title: "Desert Frequencies",
		date: new Date("2024-01-12T20:00:00Z"),
		duration: 3600,
		image: null,
		url: "https://example.com/shows/desert-frequencies",
	},
] as const;

export async function seedShows(database?: Kysely<Database>): Promise<number> {
	const activeDatabase = database ?? (await import("./db.js")).db;
	await activeDatabase
		.insertInto("shows")
		.values(dummyShows.map((show) => ({ ...show })))
		.execute();
	return dummyShows.length;
}

if (import.meta.main) {
	const { db } = await import("./db.js");
	try {
		const count = await seedShows();
		console.log(`Inserted ${count} dummy shows.`);
	} finally {
		await db.destroy();
	}
}
