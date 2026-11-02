import { expect, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect } from "kysely";
import { adminRoutes } from "../../src/admin/admin.js";
import { showRoutes } from "../../src/admin/routes/shows/index.js";
import { authOrigin } from "../../src/auth/auth.js";
import type { Database } from "../../src/db/types.js";

for (const scenario of [
	"success",
	"missing",
	"failure",
	"invalid",
	"oversized",
] as const) {
	test(`Show deletion: ${scenario}`, async () => {
		const queries: string[] = [];
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: {
					connect: async () => ({
						query: async (query: string) => {
							queries.push(query);
							if (
								scenario === "failure" &&
								query.includes('delete from "shows"')
							)
								throw new Error("offline");
							return {
								rows:
									query.includes('delete from "shows"') &&
									scenario === "success"
										? [{ id: 5 }]
										: [],
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
			await app.register(showRoutes(db));
			const response = await app.inject({
				method: "POST",
				url: "/remove-show",
				payload: {
					id:
						scenario === "invalid"
							? -1
							: scenario === "oversized"
								? 2147483648
								: 5,
				},
			});
			expect(response.statusCode).toBe(
				{
					success: 200,
					missing: 404,
					failure: 500,
					invalid: 400,
					oversized: 404,
				}[scenario],
			);
			if (scenario === "success") expect(response.json()).toEqual({ id: 5 });
			if (scenario === "failure") {
				expect(queries.at(-1)).toBe("rollback");
				expect(response.json()).toEqual({ error: "Internal Server Error" });
			}
			if (scenario === "invalid" || scenario === "oversized")
				expect(queries).toEqual([]);
		} finally {
			await app.close();
			await db.destroy();
		}
	});
}

for (const [role, expected] of [
	[undefined, 401],
	["user", 403],
	["editor", 400],
	["admin", 400],
] as const) {
	test(`Show deletion permissions: ${role ?? "signed out"}`, async () => {
		const app = Fastify();
		await app.register(
			adminRoutes(
				{
					api: {
						getSession: async () =>
							role ? { user: { id: "actor", role } } : null,
					},
				} as never,
				{} as never,
			),
		);
		try {
			const response = await app.inject({
				method: "POST",
				url: "/api/admin/remove-show",
				headers: { origin: authOrigin },
				payload: {},
			});
			expect(response.statusCode).toBe(expected);
		} finally {
			await app.close();
		}
	});
}
