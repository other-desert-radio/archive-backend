import { describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";

const adminSession = {
	api: {
		getSession: async () => ({
			user: { id: "admin-user", role: "admin" },
		}),
	},
} as never;

type TagRow = {
	id: number;
	title: string;
	color: string;
	reviewed: boolean;
};

type DJRow = {
	id: number;
	title: string;
	bio: string;
	image: string | null;
	socials: string | null;
};

const buildDatabase = (initialTags: TagRow[] = [], failOn?: string) => {
	const state = {
		tags: [...initialTags],
		djs: [] as DJRow[],
		djTags: [] as Array<{ dj_id: number; tag_id: number }>,
	};
	let nextTagId = Math.max(0, ...state.tags.map((tag) => tag.id)) + 1;
	let nextDJId = 1;

	const database = {
		transaction: () => ({
			execute: async (callback: (transaction: never) => Promise<unknown>) => {
				const snapshot = structuredClone(state);

				try {
					return await callback({
						selectFrom: () => ({
							select: () => ({
								execute: async () => state.tags,
							}),
						}),
						insertInto: (table: string) => {
							let values: unknown;
							const builder = {
								values: (input: unknown) => {
									values = input;
									return builder;
								},
								returning: () => builder,
								executeTakeFirstOrThrow: async () => {
									if (failOn === table) throw new Error("insert failed");
									if (table === "tags") {
										const tag = {
											id: nextTagId++,
											...(values as Omit<TagRow, "id">),
										};
										state.tags.push(tag);
										return tag;
									}
									const dj = {
										id: nextDJId++,
										...(values as Omit<DJRow, "id">),
									};
									state.djs.push(dj);
									return dj;
								},
								execute: async () => {
									if (failOn === table) throw new Error("insert failed");
									if (table === "dj_tags") {
										state.djTags.push(
											...(values as Array<{ dj_id: number; tag_id: number }>),
										);
									}
								},
							};
							return builder;
						},
					} as never);
				} catch (error) {
					state.tags = snapshot.tags;
					state.djs = snapshot.djs;
					state.djTags = snapshot.djTags;
					throw error;
				}
			},
		}),
	} as never;

	return { database, state };
};

const createDJ = async (database: never, payload: unknown) => {
	const app = Fastify({ logger: false });
	await app.register(adminRoutes(adminSession, database));
	const response = await app.inject({
		method: "POST",
		url: "/api/admin/create-dj",
		payload,
	});
	await app.close();
	return response;
};

describe("DJ creation persistence", () => {
	test("creates a DJ, new tags, and direct relationships", async () => {
		const { database, state } = buildDatabase();
		const response = await createDJ(database, {
			title: " DJ New ",
			bio: "First line\nSecond line",
			tags: ["Dance"],
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toMatchObject({
			id: 1,
			title: "DJ New",
			bio: "<p>First line<br />Second line</p>",
			shows: [],
			tags: [1],
		});
		expect(state.tags[0]?.reviewed).toBe(false);
		expect(state.djTags).toEqual([{ dj_id: 1, tag_id: 1 }]);
	});

	test("reuses an existing tag case-insensitively", async () => {
		const { database, state } = buildDatabase([
			{ id: 7, title: "Dance", color: "#123456", reviewed: true },
		]);
		const response = await createDJ(database, {
			title: "DJ New",
			bio: "A bio",
			tags: [" dance "],
		});

		expect(response.statusCode).toBe(201);
		expect(response.json().tags).toEqual([7]);
		expect(state.tags).toHaveLength(1);
	});

	test("deduplicates submitted tags", async () => {
		const { database, state } = buildDatabase();
		const response = await createDJ(database, {
			title: "DJ New",
			bio: "A bio",
			tags: ["Dance", "dance"],
		});

		expect(response.statusCode).toBe(201);
		expect(response.json().tags).toEqual([1]);
		expect(state.tags).toHaveLength(1);
		expect(state.djTags).toEqual([{ dj_id: 1, tag_id: 1 }]);
	});

	test("rolls back the DJ and tags when relationships fail", async () => {
		const { database, state } = buildDatabase([], "dj_tags");
		const response = await createDJ(database, {
			title: "DJ New",
			bio: "A bio",
			tags: ["Dance"],
		});

		expect(response.statusCode).toBe(500);
		expect(response.json()).toEqual({ error: "Internal Server Error" });
		expect(state.tags).toEqual([]);
		expect(state.djs).toEqual([]);
		expect(state.djTags).toEqual([]);
	});
});
