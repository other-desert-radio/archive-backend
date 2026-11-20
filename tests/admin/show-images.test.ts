import { expect, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect } from "kysely";
import { showRoutes } from "../../src/admin/routes/shows/index.js";
import type { Database } from "../../src/db/types.js";

test("show list retains Mixcloud URLs without querying removed image fields", async () => {
	const queries: string[] = [];
	const row = {
		id: 42,
		createdAt: new Date("2026-01-01"),
		title: "Show",
		date: new Date("2026-01-01"),
		duration: 60,
		url: "audio",
		mixcloud_image_small: "small-url",
		mixcloud_image_large: "large-url",
		tracklist: [
			{ artist: "Artist", song: "Song", start_time: null },
			{ chapter: "Intro", start_time: 0 },
		],
	};
	const db = new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: {
				connect: async () => ({
					query: async (query: string) => {
						queries.push(query);
						return { rows: query.includes('from "shows"') ? [row] : [] };
					},
					release: () => {},
				}),
				end: async () => {},
			} as never,
		}),
	});
	const app = Fastify({ logger: false });
	try {
		await app.register(showRoutes(db));
		const response = await app.inject("/shows");
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual([
			{
				id: 42,
				tracklist: row.tracklist,
				createdAt: row.createdAt.toISOString(),
				title: "Show",
				date: row.date.toISOString(),
				duration: 60,
				url: "audio",
				image: "large-url",
				mixcloud_image_small: "small-url",
				mixcloud_image_large: "large-url",
				djs: [],
				tags: [],
			},
		]);
		expect(queries[0]).not.toContain('"image_small"');
		expect(queries[0]).not.toContain('"image_large"');
		expect(queries[0]).not.toContain("has_images");
		expect(
			app.hasRoute({ method: "GET", url: "/shows/:id/image/:variant" }),
		).toBe(false);
	} finally {
		await app.close();
		await db.destroy();
	}
});
