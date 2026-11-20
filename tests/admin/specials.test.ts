import { expect, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect } from "kysely";
import { adminRoutes } from "../../src/admin/admin.js";
import { specialRoutes } from "../../src/admin/routes/specials/index.js";
import { authOrigin } from "../../src/auth/auth.js";
import type { Database } from "../../src/db/types.js";

for (const scenario of [
	"success",
	"missing",
	"failure",
	"linked",
	"unrelated_fk",
	"invalid",
	"oversized",
] as const) {
	test(`Special deletion: ${scenario}`, async () => {
		const queries: string[] = [];
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: {
					connect: async () => ({
						query: async (query: string) => {
							queries.push(query);
							if (scenario === "linked" || scenario === "unrelated_fk")
								throw {
									code: "23503",
									constraint:
										scenario === "linked"
											? "shows_special_id_fkey"
											: "other_fkey",
								};
							if (
								scenario === "failure" &&
								query.includes('delete from "specials"')
							)
								throw new Error("offline");
							return {
								rows:
									query.includes('delete from "specials"') &&
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
			await app.register(specialRoutes(db));
			const response = await app.inject({
				method: "POST",
				url: "/remove-special",
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
					linked: 409,
					unrelated_fk: 500,
					invalid: 400,
					oversized: 404,
				}[scenario],
			);
			if (scenario === "success") expect(response.json()).toEqual({ id: 5 });
			if (scenario === "failure") {
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
	test(`Special deletion permissions: ${role ?? "signed out"}`, async () => {
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
			const rename = await app.inject({
				method: "POST",
				url: "/api/admin/modify-special",
				headers: { origin: authOrigin },
				payload: {},
			});
			expect(rename.statusCode).toBe(expected);
			const response = await app.inject({
				method: "POST",
				url: "/api/admin/remove-special",
				headers: { origin: authOrigin },
				payload: {},
			});
			expect(response.statusCode).toBe(expected);
		} finally {
			await app.close();
		}
	});
}
for (const scenario of [
	"success",
	"empty",
	"missing",
	"invalid",
	"oversized",
	"failure",
	"unknown failure",
	"empty failure",
] as const) {
	test(`Special deletion preview: ${scenario}`, async () => {
		const queries: string[] = [];
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: {
					connect: async () => ({
						query: async (query: string) => {
							queries.push(query);
							if (scenario === "failure") throw new Error("offline");
							if (scenario === "unknown failure") throw "offline";
							if (scenario === "empty failure") throw new Error(" ");
							return {
								rows: query.includes('from "specials"')
									? scenario === "missing"
										? []
										: [{ id: 5, title: "Special" }]
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
			await app.register(specialRoutes(db));
			const response = await app.inject({
				method: "GET",
				url: `/specials/${scenario === "invalid" ? "1e0" : scenario === "oversized" ? "2147483648" : "5"}/delete-impact`,
			});
			expect(response.statusCode).toBe(
				{
					success: 200,
					empty: 200,
					missing: 404,
					invalid: 400,
					oversized: 404,
					failure: 500,
					"unknown failure": 500,
					"empty failure": 500,
				}[scenario],
			);
			if (scenario === "success")
				expect(response.json()).toEqual({
					special: { id: 5, title: "Special" },
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
				expect(response.json()).toEqual({
					error: "Unable to load Special deletion preview. Please try again.",
				});
			if (scenario === "unknown failure" || scenario === "empty failure")
				expect(response.json()).toEqual({
					error: "Unable to load Special deletion preview. Please try again.",
				});
		} finally {
			await app.close();
			await db.destroy();
		}
	});
}

for (const scenario of [
	"list",
	"create",
	"blank",
	"shape",
	"failure",
] as const) {
	test(`Special management: ${scenario}`, async () => {
		let values: unknown;
		const row = { id: 5, title: "Night", createdAt: new Date("2026-01-01Z") };
		const builder = {
			selectAll: () => builder,
			orderBy: () => builder,
			values: (input: unknown) => {
				values = input;
				return builder;
			},
			returningAll: () => builder,
			execute: async () => [row],
			executeTakeFirstOrThrow: async () => {
				if (scenario === "failure") throw new Error("offline");
				return row;
			},
		};
		const app = Fastify();
		try {
			await app.register(
				specialRoutes({
					selectFrom: () => builder,
					insertInto: () => builder,
				} as never),
			);
			const response = await app.inject(
				scenario === "list"
					? { method: "GET", url: "/specials" }
					: {
							method: "POST",
							url: "/create-special",
							payload:
								scenario === "shape"
									? { title: 123 }
									: { title: scenario === "blank" ? "   " : "  Night  " },
						},
			);
			expect(response.statusCode).toBe(
				{ list: 200, create: 201, blank: 400, shape: 400, failure: 500 }[
					scenario
				],
			);
			if (scenario === "create") {
				expect(values).toEqual({ title: "Night", description: null });
				expect(response.json()).toEqual({
					...row,
					createdAt: row.createdAt.toISOString(),
				});
			}
			if (scenario === "list")
				expect(response.json()).toEqual([
					{ ...row, createdAt: row.createdAt.toISOString() },
				]);
			if (scenario === "blank" || scenario === "shape")
				expect(values).toBeUndefined();
		} finally {
			await app.close();
		}
	});
}

for (const scenario of [
	"success",
	"blank",
	"invalid",
	"missing",
	"failure",
] as const) {
	test(`Special rename: ${scenario}`, async () => {
		let changed: unknown;
		const row = { id: 5, title: "Renamed", createdAt: new Date("2026-01-01Z") };
		const builder = {
			set: (value: unknown) => {
				changed = value;
				return builder;
			},
			where: () => builder,
			returningAll: () => builder,
			executeTakeFirst: async () => {
				if (scenario === "failure") throw new Error("offline");
				return scenario === "missing" ? undefined : row;
			},
		};
		const app = Fastify();
		try {
			await app.register(
				specialRoutes({ updateTable: () => builder } as never),
			);
			const response = await app.inject({
				method: "POST",
				url: "/modify-special",
				payload: {
					id: scenario === "invalid" ? "5" : 5,
					title: scenario === "blank" ? "   " : "  Renamed  ",
				},
			});
			expect(response.statusCode).toBe(
				{ success: 200, blank: 400, invalid: 400, missing: 404, failure: 500 }[
					scenario
				],
			);
			if (scenario === "success") {
				expect(changed).toEqual({ title: "Renamed" });
				expect(response.json()).toEqual({
					...row,
					createdAt: row.createdAt.toISOString(),
				});
			}
			if (scenario === "blank" || scenario === "invalid")
				expect(changed).toBeUndefined();
		} finally {
			await app.close();
		}
	});
}

for (const endpoint of ["create-special", "modify-special"]) {
	for (const description of [
		undefined,
		"",
		"  Hello\n<script>alert(1)</script>  ",
		42,
		null,
	]) {
		test(`${endpoint} description: ${JSON.stringify(description)}`, async () => {
			let stored: unknown;
			const builder = {
				values: (value: unknown) => {
					stored = value;
					return builder;
				},
				set: (value: unknown) => {
					stored = value;
					return builder;
				},
				where: () => builder,
				returningAll: () => builder,
				executeTakeFirst: async () => ({
					id: 5,
					title: "Night",
					createdAt: new Date(),
					description: "<p>Saved</p>",
				}),
				executeTakeFirstOrThrow: async () => builder.executeTakeFirst(),
			};
			const app = Fastify();
			try {
				await app.register(
					specialRoutes({
						insertInto: () => builder,
						updateTable: () => builder,
					} as never),
				);
				const response = await app.inject({
					method: "POST",
					url: `/${endpoint}`,
					payload: { id: 5, title: "Night", description },
				});
				if (description === null || typeof description === "number") {
					expect(response.statusCode).toBe(400);
					expect(stored).toBeUndefined();
				} else {
					expect(response.statusCode).toBe(
						endpoint === "create-special" ? 201 : 200,
					);
					expect(stored).toEqual({
						title: "Night",
						...(description === undefined && endpoint === "modify-special"
							? {}
							: {
									description: description
										? "<p>Hello<br />&lt;script&gt;alert(1)&lt;/script&gt;</p>"
										: null,
								}),
					});
					expect(response.json().description).toBe("<p>Saved</p>");
				}
			} finally {
				await app.close();
			}
		});
	}
}
