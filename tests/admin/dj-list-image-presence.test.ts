import { describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect } from "kysely";
import { djRoutes } from "../../src/admin/routes/djs/index.js";
import type { Database } from "../../src/db/types.js";

// Execute the real list query through a controlled PostgreSQL driver.
describe("DJ list image presence", () => {
	for (const [small, large] of [
		[true, true],
		[false, false],
		[true, false],
		[false, true],
	]) {
		test(`preserves image URLs with small=${small}, large=${large} without fetching photo bytes`, async () => {
			const queries: string[] = [];
			const db = new Kysely<Database>({
				dialect: new PostgresDialect({
					pool: {
						connect: async () => ({
							query: async (query: string) => {
								queries.push(query);
								return {
									rows: query.includes('from "djs"')
										? [
												{
													id: 42,
													createdAt: new Date("2026-01-01T00:00:00Z"),
													title: "DJ",
													bio: "Bio",
													image_small: small ? Buffer.alloc(0) : null,
													image_large: large ? Buffer.alloc(0) : null,
													socials: null,
													showTitle: null,
													showDescription: null,
												},
											]
										: [],
								};
							},
							release: () => {},
						}),
						end: async () => {},
					} as never,
				}),
			});
			const app = Fastify({ logger: false });
			try {
				await app.register(djRoutes(db));
				const response = await app.inject("/djs");
				expect(response.statusCode).toBe(200);
				expect(response.json()).toEqual([
					{
						id: 42,
						createdAt: "2026-01-01T00:00:00.000Z",
						title: "DJ",
						bio: "Bio",
						shows: [],
						tags: [],
						directTags: [],
						...(small && large
							? {
									image_small: "/api/admin/djs/42/image/small",
									image_large: "/api/admin/djs/42/image/large",
								}
							: {}),
					},
				]);
				const djQuery = queries.find((query) => query.includes('from "djs"'));
				expect(djQuery).toContain(
					"case when image_small is null then null else ''::bytea end as \"image_small\"",
				);
				expect(djQuery).toContain(
					"case when image_large is null then null else ''::bytea end as \"image_large\"",
				);
				expect(djQuery).not.toContain('"bio", "image_small", "image_large"');
			} finally {
				await app.close();
				await db.destroy();
			}
		});
	}
});
