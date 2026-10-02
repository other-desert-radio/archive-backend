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
	{
		title: "Night Drive Radio",
		date: new Date("2024-02-09T22:00:00Z"),
		duration: 5400,
		image: null,
		url: "https://example.com/shows/night-drive-radio",
	},
	{
		title: "Cactus Bloom",
		date: new Date("2024-03-16T19:30:00Z"),
		duration: 2700,
		image: null,
		url: "https://example.com/shows/cactus-bloom",
	},
	{
		title: "Static on the Mesa",
		date: new Date("2024-04-20T21:00:00Z"),
		duration: 4500,
		image: null,
		url: "https://example.com/shows/static-on-the-mesa",
	},
	{
		title: "Afterhours Signal",
		date: new Date("2024-05-03T23:00:00Z"),
		duration: 3600,
		image: null,
		url: "https://example.com/shows/afterhours-signal",
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
