import { expect, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect } from "kysely";
import { djRoutes } from "../../src/admin/routes/djs/index.js";
import type { Database } from "../../src/db/types.js";

for (const scenario of [
	"success",
	"empty",
	"missing",
	"invalid",
	"oversized",
	"failure",
] as const) {
	test(`DJ deletion preview: ${scenario}`, async () => {
		const queries: string[] = [];
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: {
					connect: async () => ({
						query: async (query: string) => {
							queries.push(query);
							if (scenario === "failure") throw new Error("offline");
							return {
								rows: query.includes('from "djs"')
									? scenario === "missing"
										? []
										: [{ id: 5, title: "DJ" }]
									: scenario === "empty"
										? []
										: [
												{ id: 3, title: "Zebra" },
												{ id: 2, title: "Alpha" },
												{ id: 1, title: "Alpha" },
											],
							};
						},
						release: () => {},
					}),
					end: async () => {},
				} as never,
			}),
		});
		const app = Fastify();
		try {
			await app.register(djRoutes(db));
			const response = await app.inject({
				method: "GET",
				url: `/djs/${scenario === "invalid" ? "1e0" : scenario === "oversized" ? "2147483648" : "5"}/delete-impact`,
			});
			expect(response.statusCode).toBe(
				{
					success: 200,
					empty: 200,
					missing: 404,
					invalid: 400,
					oversized: 404,
					failure: 500,
				}[scenario],
			);
			if (scenario === "success")
				expect(response.json()).toEqual({
					dj: { id: 5, title: "DJ" },
					shows: [
						{ id: 1, title: "Alpha" },
						{ id: 2, title: "Alpha" },
						{ id: 3, title: "Zebra" },
					],
				});
			if (scenario === "empty") expect(response.json().shows).toEqual([]);
			if (scenario === "invalid" || scenario === "oversized")
				expect(queries).toEqual([]);
			if (scenario === "failure")
				expect(response.json()).toEqual({ error: "Internal Server Error" });
		} finally {
			await app.close();
			await db.destroy();
		}
	});
}
