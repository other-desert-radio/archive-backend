import { describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";

const original = {
	id: 1,
	createdAt: new Date("2026-01-01"),
	title: "Dance",
	color: "#123456",
	reviewed: false,
	mixcloud_key: "old",
	mixcloud_url: "https://example.test/old",
};
const setup = async (role: string | null = "admin", fail = false) => {
	const rows = [
		structuredClone(original),
		{ ...original, id: 2, title: " House " },
	];
	const database = {
		transaction: () => ({
			execute: async (callback: (db: never) => Promise<unknown>) => {
				const snapshot = structuredClone(rows);
				try {
					return await callback({
						selectFrom: () => {
							let id = 0;
							let operator = "=";
							const query = {
								select: () => query,
								where: (_: string, op: string, value: number) => {
									id = value;
									operator = op;
									return query;
								},
								forUpdate: () => query,
								executeTakeFirst: async () => rows.find((row) => row.id === id),
								execute: async () =>
									rows.filter((row) =>
										operator === "!=" ? row.id !== id : row.id === id,
									),
							};
							return query;
						},
						updateTable: () => {
							let values: object;
							let id: number;
							const query = {
								set: (input: object) => {
									values = input;
									return query;
								},
								where: (_: string, _op: string, value: number) => {
									id = value;
									return query;
								},
								returningAll: () => query,
								executeTakeFirstOrThrow: async () => {
									const row = rows.find((row) => row.id === id);
									Object.assign(row ?? {}, values);
									if (fail) throw new Error("database failure");
									return row;
								},
							};
							return query;
						},
					} as never);
				} catch (error) {
					rows.splice(0, rows.length, ...snapshot);
					throw error;
				}
			},
		}),
	} as never;
	const app = Fastify();
	await app.register(
		adminRoutes(
			{
				api: {
					getSession: async () =>
						role === null ? null : { user: { id: "user", role } },
				},
			} as never,
			database,
			{ username: "", password: "" },
		),
	);
	return { app, rows };
};
const payload = {
	edit_type: "full_edit",
	id: 1,
	title: "Dance",
	color: "#123456",
};
const edit = (app: Awaited<ReturnType<typeof setup>>["app"], data: object) =>
	app.inject({ method: "POST", url: "/api/admin/modify-tag", payload: data });
describe("Tag update API", () => {
	test("partial edits update supplied fields only and mark reviewed", async () => {
		for (const [fields, expected] of [
			[{ color: " #aBc123 " }, { color: "#aBc123" }],
			[{ title: " DANCE " }, { title: "DANCE" }],
			[{ mixcloud_key: " new " }, { mixcloud_key: "new" }],
			[
				{ mixcloud_url: " https://example.test/new " },
				{ mixcloud_url: "https://example.test/new" },
			],
			[{ mixcloud_key: " " }, { mixcloud_key: null }],
			[{ mixcloud_url: "" }, { mixcloud_url: null }],
			[
				{
					title: " New ",
					color: "#abcdef",
					mixcloud_key: "",
					mixcloud_url: "",
				},
				{
					title: "New",
					color: "#abcdef",
					mixcloud_key: null,
					mixcloud_url: null,
				},
			],
		]) {
			const { app, rows } = await setup();
			try {
				const response = await edit(app, {
					edit_type: "partial_edit",
					id: 1,
					...fields,
				});
				expect(response.statusCode).toBe(200);
				expect(rows[0]).toEqual({ ...original, ...expected, reviewed: true });
				expect(response.json()).toMatchObject({ id: 1, reviewed: true });
			} finally {
				await app.close();
			}
		}
	});
	test("partial color edits skip existing title collisions", async () => {
		const { app, rows } = await setup();
		rows[0].title = "house";
		try {
			expect(
				(
					await edit(app, {
						edit_type: "partial_edit",
						id: 1,
						color: "#abcdef",
					})
				).statusCode,
			).toBe(200);
			expect(rows[0].title).toBe("house");
		} finally {
			await app.close();
		}
	});
	test("partial edits reject empty, invalid, conflicting and missing targets without writes", async () => {
		const { app, rows } = await setup();
		const before = structuredClone(rows);
		try {
			for (const fields of [
				{},
				{ reviewed: true },
				{ color: null },
				{ title: null },
				{ mixcloud_key: null },
				{ mixcloud_url: null },
				{ title: " " },
				{ title: " house " },
				{ color: "#fff" },
				{ color: "#gggggg" },
				{ mixcloud_url: "relative" },
				{ mixcloud_url: "ftp://example.test" },
				{ mixcloud_key: 1 },
				{ id: 0, color: "#abcdef" },
				{ id: 1.5, color: "#abcdef" },
				{ id: "1", color: "#abcdef" },
				{ id: Number.MAX_SAFE_INTEGER + 1, color: "#abcdef" },
			]) {
				expect(
					(await edit(app, { edit_type: "partial_edit", id: 1, ...fields }))
						.statusCode,
				).toBe(400);
				expect(rows).toEqual(before);
			}
			expect(
				(
					await edit(app, {
						edit_type: "partial_edit",
						id: 99,
						color: "#abcdef",
					})
				).statusCode,
			).toBe(404);
			expect(rows).toEqual(before);
		} finally {
			await app.close();
		}
	});
	test("partial-edit failures roll back", async () => {
		const { app, rows } = await setup("admin", true);
		try {
			const response = await edit(app, {
				edit_type: "partial_edit",
				id: 1,
				color: "#abcdef",
			});
			expect(response.statusCode).toBe(500);
			expect(response.json()).toEqual({ error: "Internal Server Error" });
			expect(rows[0]).toEqual(original);
		} finally {
			await app.close();
		}
	});

	test("review-only saves toggle both ways and preserve every other field", async () => {
		const { app, rows } = await setup();
		// Reviewing existing data does not rename tags or run title collision checks.
		rows[0].title = "house";
		const before = structuredClone(rows);
		try {
			for (const reviewed of [true, false, false]) {
				const response = await edit(app, {
					edit_type: "review",
					id: 1,
					reviewed,
				});
				expect(response.statusCode).toBe(200);
				expect(response.json()).toEqual({
					id: 1,
					title: "house",
					color: original.color,
					reviewed,
					mixcloud_key: original.mixcloud_key,
					mixcloud_url: original.mixcloud_url,
				});
				expect(rows).toEqual([{ ...before[0], reviewed }, before[1]]);
			}
		} finally {
			await app.close();
		}
	});
	test("review-only saves reject invalid or mixed payloads and unknown targets without writes", async () => {
		const { app, rows } = await setup();
		const before = structuredClone(rows);
		try {
			for (const request of [
				{ id: 1, title: "Dance", color: "#123456" },
				{ id: 1, reviewed: true },
				{ ...payload, edit_type: "unknown" },
				{ edit_type: "review", id: 1 },
				{ ...payload, edit_type: "review" },
				{ edit_type: "review", id: 1, reviewed: "false" },
				{ edit_type: "review", id: 1, reviewed: null },
				{ edit_type: "review", id: 1, reviewed: 1 },
				{ edit_type: "review", reviewed: true },
				{ edit_type: "review", id: 0, reviewed: false },
				{ edit_type: "review", id: 1.5, reviewed: true },
				{
					edit_type: "review",
					id: Number.MAX_SAFE_INTEGER + 1,
					reviewed: true,
				},
				{ edit_type: "review", id: "1", reviewed: true },
				{ edit_type: "review", id: 1, reviewed: false, title: "New" },
				{ ...payload, reviewed: false },
				{ edit_type: "review", id: 1, reviewed: true, mixcloud_key: "new" },
			]) {
				expect((await edit(app, request)).statusCode).toBe(400);
				expect(rows).toEqual(before);
			}
			expect(
				(await edit(app, { edit_type: "review", id: 99, reviewed: false }))
					.statusCode,
			).toBe(404);
			expect(rows).toEqual(before);
		} finally {
			await app.close();
		}
	});
	test("review-only database failures roll back and return a generic error", async () => {
		const { app, rows } = await setup("admin", true);
		try {
			const response = await edit(app, {
				edit_type: "review",
				id: 1,
				reviewed: true,
			});
			expect(response.statusCode).toBe(500);
			expect(response.json()).toEqual({ error: "Internal Server Error" });
			expect(rows[0]).toEqual(original);
		} finally {
			await app.close();
		}
	});

	test("trims all fields, reviews, preserves identity/timestamp, and clears optional metadata", async () => {
		const { app, rows } = await setup();
		try {
			const response = await edit(app, {
				...payload,
				title: " DANCE ",
				color: " #aBc123 ",
				mixcloud_key: " new ",
				mixcloud_url: " https://example.test/new ",
			});
			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				id: 1,
				title: "DANCE",
				color: "#aBc123",
				reviewed: true,
				mixcloud_key: "new",
				mixcloud_url: "https://example.test/new",
			});
			expect(rows[0]?.createdAt).toEqual(original.createdAt);
			expect(
				(
					await edit(app, { ...payload, mixcloud_key: " ", mixcloud_url: " " })
				).json(),
			).toEqual({ id: 1, title: "Dance", color: "#123456", reviewed: true });
			expect(rows[0]).toMatchObject({ mixcloud_key: null, mixcloud_url: null });
		} finally {
			await app.close();
		}
	});
	test("optional Mixcloud fields are independently replaceable", async () => {
		const { app, rows } = await setup();
		try {
			expect(
				(await edit(app, { ...payload, mixcloud_key: " key " })).statusCode,
			).toBe(200);
			expect(rows[0]).toMatchObject({
				mixcloud_key: "key",
				mixcloud_url: null,
			});
			expect(
				(
					await edit(app, {
						...payload,
						mixcloud_url: " http://example.test/genre ",
					})
				).statusCode,
			).toBe(200);
			expect(rows[0]).toMatchObject({
				mixcloud_key: null,
				mixcloud_url: "http://example.test/genre",
			});
		} finally {
			await app.close();
		}
	});
	test("unchanged saves mark reviewed and omitted metadata clears", async () => {
		const { app, rows } = await setup();
		try {
			expect((await edit(app, payload)).statusCode).toBe(200);
			expect(rows[0]).toMatchObject({
				reviewed: true,
				mixcloud_key: null,
				mixcloud_url: null,
			});
		} finally {
			await app.close();
		}
	});
	test("rejects malformed requests, duplicates, and unknown IDs without writes", async () => {
		const { app, rows } = await setup();
		const before = structuredClone(rows);
		try {
			for (const change of [
				{ id: undefined },
				{ title: undefined },
				{ color: undefined },
				{ id: 0 },
				{ id: -1 },
				{ id: 1.5 },
				{ id: Number.MAX_SAFE_INTEGER + 1 },
				{ id: "1" },
				{ title: " " },
				{ title: " house " },
				{ color: "#fff" },
				{ color: "#gggggg" },
				{ mixcloud_url: "relative" },
				{ mixcloud_url: "ftp://example.test" },
				{ mixcloud_key: 1 },
			]) {
				expect((await edit(app, { ...payload, ...change })).statusCode).toBe(
					400,
				);
				expect(rows).toEqual(before);
			}
			expect((await edit(app, { ...payload, id: 99 })).statusCode).toBe(404);
			expect(rows).toEqual(before);
		} finally {
			await app.close();
		}
	});
	test("unexpected failures roll back and return a generic error", async () => {
		const { app, rows } = await setup("admin", true);
		try {
			const response = await edit(app, { ...payload, title: "New" });
			expect(response.statusCode).toBe(500);
			expect(response.json()).toEqual({ error: "Internal Server Error" });
			expect(rows[0]).toEqual(original);
		} finally {
			await app.close();
		}
	});
	for (const [role, status] of [
		[null, 401],
		["user", 403],
	] as const)
		test(`requires admin access (${status})`, async () => {
			const { app, rows } = await setup(role);
			try {
				expect((await edit(app, payload)).statusCode).toBe(status);
				expect(
					(
						await edit(app, {
							edit_type: "partial_edit",
							id: 1,
							color: "#abcdef",
						})
					).statusCode,
				).toBe(status);
				expect(
					(await edit(app, { edit_type: "review", id: 1, reviewed: true }))
						.statusCode,
				).toBe(status);
				expect(rows[0]).toEqual(original);
			} finally {
				await app.close();
			}
		});
});
