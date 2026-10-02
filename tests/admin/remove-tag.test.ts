import { describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";

const setup = async (role: string | null = "admin", fail = false) => {
	let removed = false;
	const database = {
		selectFrom: (table: string) => {
			let inherited = false;
			let id = 0;
			const query = {
				select: () => query,
				innerJoin: (joined: string) => {
					if (joined === "show_djs") inherited = true;
					return query;
				},
				where: (_column: string, _operator: string, value: number) => {
					id = value;
					return query;
				},
				distinct: () => query,
				executeTakeFirst: async () => {
					if (fail) throw new Error("private database details");
					return id === 1 && !removed ? { id: 1, title: "Dance" } : undefined;
				},
				execute: async () => {
					if (fail) throw new Error("private database details");
					if (table === "dj_tags")
						return [
							{ id: 2, title: "B" },
							{ id: 1, title: "A" },
						];
					if (inherited)
						return [
							{ id: 2, title: "B" },
							{ id: 3, title: "C" },
						];
					return [
						{ id: 5, title: "Z" },
						{ id: 4, title: "Z" },
					];
				},
			};
			return query;
		},
		deleteFrom: (table: string) => {
			expect(table).toBe("tags");
			let id = 0;
			const query = {
				where: (column: string, operator: string, value: number) => {
					expect([column, operator]).toEqual(["id", "="]);
					id = value;
					return query;
				},
				returning: () => query,
				executeTakeFirst: async () => {
					if (fail) throw new Error("private database details");
					if (id !== 1 || removed) return undefined;
					removed = true;
					return { id };
				},
			};
			return query;
		},
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
	return { app, isRemoved: () => removed };
};
const preview = (
	app: Awaited<ReturnType<typeof setup>>["app"],
	id: string = "1",
) => app.inject({ method: "GET", url: `/api/admin/tags/${id}/delete-impact` });
const remove = (
	app: Awaited<ReturnType<typeof setup>>["app"],
	payload: unknown = { id: 1 },
) =>
	app.inject({
		method: "POST",
		url: "/api/admin/remove-tag",
		payload: payload as object,
	});

describe("Tag deletion API", () => {
	test("preview deduplicates direct/inherited DJs and sorts title ties by ID", async () => {
		const { app, isRemoved } = await setup();
		try {
			const response = await preview(app);
			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				tag: { id: 1, title: "Dance" },
				shows: [
					{ id: 4, title: "Z" },
					{ id: 5, title: "Z" },
				],
				djs: [
					{ id: 1, title: "A", assignment: "direct" },
					{ id: 2, title: "B", assignment: "both" },
					{ id: 3, title: "C", assignment: "inherited" },
				],
			});
			expect(isRemoved()).toBe(false);
		} finally {
			await app.close();
		}
	});
	test("deletes once and returns 404 for repeated or unknown targets", async () => {
		const { app } = await setup();
		try {
			expect((await remove(app)).json()).toEqual({ id: 1 });
			expect((await remove(app)).statusCode).toBe(404);
			for (const id of [99, Number.MAX_SAFE_INTEGER]) {
				expect((await remove(app, { id })).statusCode).toBe(404);
				expect((await preview(app, String(id))).statusCode).toBe(404);
			}
		} finally {
			await app.close();
		}
	});
	test("invalid IDs and bodies are rejected without deletion", async () => {
		const { app, isRemoved } = await setup();
		try {
			for (const payload of [
				{},
				{ id: "1" },
				{ id: null },
				{ id: 0 },
				{ id: -1 },
				{ id: 1.5 },
				{ id: Number.MAX_SAFE_INTEGER + 1 },
			])
				expect((await remove(app, payload)).statusCode).toBe(400);
			for (const id of ["no", "0", "-1", "1.5", "1e0", "9007199254740992"])
				expect((await preview(app, id)).statusCode).toBe(400);
			expect(isRemoved()).toBe(false);
		} finally {
			await app.close();
		}
	});
	for (const [role, status] of [
		[null, 401],
		["user", 403],
	] as const)
		test(`requires admin access (${status})`, async () => {
			const { app, isRemoved } = await setup(role);
			try {
				expect((await preview(app)).statusCode).toBe(status);
				expect((await remove(app)).statusCode).toBe(status);
				expect(isRemoved()).toBe(false);
			} finally {
				await app.close();
			}
		});
	test("database failures return generic errors without deletion", async () => {
		const { app, isRemoved } = await setup("admin", true);
		try {
			for (const response of [await preview(app), await remove(app)]) {
				expect(response.statusCode).toBe(500);
				expect(response.json()).toEqual({ error: "Internal Server Error" });
			}
			expect(isRemoved()).toBe(false);
		} finally {
			await app.close();
		}
	});
});
