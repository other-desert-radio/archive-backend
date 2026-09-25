import { describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";

const adminSession = {
	api: {
		getSession: async () => ({ user: { id: "admin-user", role: "admin" } }),
	},
} as never;
type Tag = { id: number; title: string; color: string; reviewed: boolean };
const buildDatabase = (failOn?: string) => {
	const state = {
		djs: [{ id: 1 }, { id: 2 }],
		tags: [] as Tag[],
		shows: [] as Array<Record<string, unknown>>,
		showDJs: [] as Array<Record<string, number>>,
		showTags: [] as Array<Record<string, number>>,
	};
	let nextTagId = 1;
	let nextShowId = 1;
	const database = {
		transaction: () => ({
			execute: async (callback: (transaction: never) => Promise<unknown>) => {
				const snapshot = structuredClone(state);
				try {
					return await callback({
						selectFrom: (table: string) => {
							const rows = table === "djs" ? state.djs : state.tags;
							let ids: number[] | undefined;
							const query = {
								select: () => query,
								where: (
									_column: string,
									_operator: string,
									value: number[],
								) => {
									ids = value;
									return query;
								},
								execute: async () =>
									ids === undefined
										? rows
										: rows.filter((row) => ids?.includes(row.id)),
							};
							return query;
						},
						insertInto: (table: string) => {
							let values: unknown;
							const query = {
								values: (input: unknown) => {
									values = input;
									return query;
								},
								returning: () => query,
								executeTakeFirstOrThrow: async () => {
									if (failOn === table) throw new Error("insert failed");
									if (table === "tags") {
										const tag = {
											id: nextTagId++,
											...(values as Omit<Tag, "id">),
										};
										state.tags.push(tag);
										return tag;
									}
									const show = {
										id: nextShowId++,
										createdAt: new Date("2026-01-01T00:00:00.000Z"),
										...(values as Record<string, unknown>),
									};
									state.shows.push(show);
									return show;
								},
								execute: async () => {
									if (failOn === table) throw new Error("insert failed");
									if (table === "show_djs")
										state.showDJs.push(
											...(values as Array<Record<string, number>>),
										);
									if (table === "show_tags")
										state.showTags.push(
											...(values as Array<Record<string, number>>),
										);
								},
							};
							return query;
						},
					} as never);
				} catch (error) {
					Object.assign(state, snapshot);
					throw error;
				}
			},
		}),
	} as never;
	return { database, state };
};
const createShow = async (database: never, payload: unknown) => {
	const app = Fastify({ logger: false });
	await app.register(adminRoutes(adminSession, database));
	const response = await app.inject({
		method: "POST",
		url: "/api/admin/create-show",
		payload,
	});
	await app.close();
	return response;
};

describe("Show creation persistence", () => {
	test("creates a Show, relationships, and new tags atomically", async () => {
		const { database, state } = buildDatabase();
		const response = await createShow(database, {
			title: " Night ",
			date: "2024-02-29",
			duration: 3661,
			image: " https://example.com/art.jpg ",
			url: "https://example.com/show",
			djs: [2, 1, 2],
			tags: ["Ambient", "ambient"],
		});
		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual({
			id: 1,
			createdAt: "2026-01-01T00:00:00.000Z",
			title: "Night",
			date: "2024-02-29T00:00:00.000Z",
			duration: 3661,
			image: "https://example.com/art.jpg",
			url: "https://example.com/show",
			djs: [1, 2],
			tags: [1],
		});
		expect(state.showDJs).toEqual([
			{ show_id: 1, dj_id: 2 },
			{ show_id: 1, dj_id: 1 },
		]);
		expect(state.showTags).toEqual([{ show_id: 1, tag_id: 1 }]);
		expect(state.tags[0]?.reviewed).toBe(false);
	});

	test("rejects missing DJs and rolls back all writes after a later failure", async () => {
		const missing = buildDatabase();
		expect(
			(
				await createShow(missing.database, {
					title: "Night",
					date: "2024-01-01",
					duration: 1,
					url: "https://example.com/show",
					djs: [99],
				})
			).statusCode,
		).toBe(400);
		const failed = buildDatabase("show_djs");
		const response = await createShow(failed.database, {
			title: "Night",
			date: "2024-01-01",
			duration: 1,
			url: "https://example.com/show",
			djs: [1],
			tags: ["Ambient"],
		});
		expect(response.statusCode, response.body).toBe(500);
		expect(response.json()).toEqual({ error: "Internal Server Error" });
		expect(failed.state).toEqual({
			djs: [{ id: 1 }, { id: 2 }],
			tags: [],
			shows: [],
			showDJs: [],
			showTags: [],
		});
	});
});
