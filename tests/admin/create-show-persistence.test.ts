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
						updateTable: () => {
							let id: number;
							let values: Record<string, unknown>;
							const query = {
								set: (input: Record<string, unknown>) => {
									values = input;
									return query;
								},
								where: (_column: string, _operator: string, value: number) => {
									id = value;
									return query;
								},
								returning: () => query,
								executeTakeFirst: async () => {
									if (failOn === "shows") throw new Error("update failed");
									const show = state.shows.find((show) => show.id === id);
									if (show !== undefined) Object.assign(show, values);
									return show;
								},
							};
							return query;
						},
						deleteFrom: (table: string) => {
							let id: number;
							const query = {
								where: (_column: string, _operator: string, value: number) => {
									id = value;
									return query;
								},
								execute: async () => {
									if (table === "show_djs")
										state.showDJs = state.showDJs.filter(
											(row) => row.show_id !== id,
										);
									if (table === "show_tags")
										state.showTags = state.showTags.filter(
											(row) => row.show_id !== id,
										);
								},
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
			image_small: " https://example.com/small.jpg ",
			image_large: " https://example.com/art.jpg ",
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
			image_small: "https://example.com/small.jpg",
			image_large: "https://example.com/art.jpg",
			url: "https://example.com/show",
			djs: [1, 2],
			tags: [1],
		});
		expect(state.shows[0]).toMatchObject({
			image_small: response.json().image_small,
			image_large: response.json().image_large,
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
					image_small: "https://example.com/small.jpg",
					image_large: "https://example.com/large.jpg",
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
			image_small: "https://example.com/small.jpg",
			image_large: "https://example.com/large.jpg",
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

const editPayload = {
	id: 1,
	image_small: "https://example.com/small.jpg",
	image_large: "https://example.com/large.jpg",
	title: " Changed ",
	date: "2024-02-29",
	duration: 3661,
	url: " https://example.com/changed ",
	djs: [2, 2],
};
const editingDatabase = (failOn?: string) => {
	const fixture = buildDatabase(failOn);
	fixture.state.shows.push({
		id: 1,
		createdAt: new Date("2026-01-01T00:00:00Z"),
		title: "Original",
		date: new Date("2024-01-01T00:00:00Z"),
		duration: 1,
		image: "https://example.com/original.jpg",
		url: "https://example.com/original",
	});
	fixture.state.tags.push({
		id: 20,
		title: "Ambient",
		color: "#123456",
		reviewed: true,
	});
	fixture.state.showDJs.push(
		{ show_id: 1, dj_id: 1 },
		{ show_id: 99, dj_id: 1 },
	);
	fixture.state.showTags.push(
		{ show_id: 1, tag_id: 20 },
		{ show_id: 99, tag_id: 20 },
	);
	return fixture;
};
const modifyShow = async (
	database: never,
	payload: unknown,
	session = adminSession,
) => {
	const app = Fastify({ logger: false });
	await app.register(
		adminRoutes(session, database, { username: "", password: "" }),
	);
	try {
		return await app.inject({
			method: "POST",
			url: "/api/admin/modify-show",
			payload,
		});
	} finally {
		await app.close();
	}
};

describe("Show editing persistence", () => {
	test("replaces metadata and links, reuses tags, and preserves other records", async () => {
		const { database, state } = editingDatabase();
		const response = await modifyShow(database, {
			...editPayload,
			image_small: " https://example.com/new-small.jpg ",
			image_large: " https://example.com/new.jpg ",
			tags: ["ambient", "New", "new"],
		});
		expect(response.statusCode, response.body).toBe(200);
		expect(response.json()).toEqual({
			id: 1,
			createdAt: "2026-01-01T00:00:00.000Z",
			title: "Changed",
			date: "2024-02-29T00:00:00.000Z",
			duration: 3661,
			image: "https://example.com/new.jpg",
			image_small: "https://example.com/new-small.jpg",
			image_large: "https://example.com/new.jpg",
			url: "https://example.com/changed",
			djs: [2],
			tags: [1, 20],
		});
		expect(state.shows[0]).toMatchObject({
			image_small: response.json().image_small,
			image_large: response.json().image_large,
		});
		expect(state.showDJs).toEqual([
			{ show_id: 99, dj_id: 1 },
			{ show_id: 1, dj_id: 2 },
		]);
		expect(state.showTags).toEqual([
			{ show_id: 99, tag_id: 20 },
			{ show_id: 1, tag_id: 20 },
			{ show_id: 1, tag_id: 1 },
		]);
		expect(state.tags).toHaveLength(2);
		expect(state.tags[0]).toEqual({
			id: 20,
			title: "Ambient",
			color: "#123456",
			reviewed: true,
		});
		expect(state.tags[1]?.reviewed).toBe(false);
		expect(state.djs).toEqual([{ id: 1 }, { id: 2 }]);
	});
	test("clears omitted or empty tags while preserving required images", async () => {
		for (const optional of [{}, { tags: [] }]) {
			const { database, state } = editingDatabase();
			const response = await modifyShow(database, {
				...editPayload,
				...optional,
			});
			expect(response.statusCode).toBe(200);
			expect(response.json().image_large).toBe(editPayload.image_large);
			expect(response.json().image_small).toBe(editPayload.image_small);
			expect(response.json().tags).toEqual([]);
			expect(state.shows[0]?.image_large).toBe(editPayload.image_large);
			expect(state.showTags).toEqual([{ show_id: 99, tag_id: 20 }]);
			expect(state.tags).toHaveLength(1);
		}
	});
	test("rejects invalid shapes and values without writing", async () => {
		for (const changes of [
			{ id: undefined },
			{ id: "1" },
			{ id: 0 },
			{ id: 1.5 },
			{ id: Number.MAX_SAFE_INTEGER + 1 },
			{ title: " " },
			{ date: "2024-02-30" },
			{ date: "2023-02-29" },
			{ url: "ftp://example.com/show" },
			{ image_small: undefined },
			{ image_small: null },
			{ image_small: "" },
			{ image_small: " " },
			{ image_small: "relative.jpg" },
			{ image_small: "ftp://example.test/image" },
			{ image_large: undefined },
			{ image_large: null },
			{ image_large: "" },
			{ image_large: " " },
			{ image_large: "relative.jpg" },
			{ image_large: "ftp://example.test/image" },
			{ duration: 0 },
			{ duration: 1.5 },
			{ duration: 2147483648 },
			{ djs: [] },
			{ djs: [0] },
			{ djs: [99] },
			{ tags: [1] },
		]) {
			const { database, state } = editingDatabase();
			const before = structuredClone(state);
			const response = await modifyShow(database, {
				...editPayload,
				...changes,
			});
			expect(response.statusCode, response.body).toBe(400);
			expect(state).toEqual(before);
		}
	});
	test("returns 404 without creating tags for an unknown Show", async () => {
		const { database, state } = editingDatabase();
		const before = structuredClone(state);
		const response = await modifyShow(database, {
			...editPayload,
			id: 100,
			tags: ["New"],
		});
		expect(response.statusCode).toBe(404);
		expect(response.json()).toEqual({ error: "Not Found" });
		expect(state).toEqual(before);
	});
	test("rolls back metadata, tag creation, and removed links after failures", async () => {
		for (const table of ["shows", "tags", "show_djs", "show_tags"]) {
			const { database, state } = editingDatabase(table);
			const before = structuredClone(state);
			const response = await modifyShow(database, {
				...editPayload,
				tags: ["New"],
			});
			expect(response.statusCode, response.body).toBe(500);
			expect(response.json()).toEqual({ error: "Internal Server Error" });
			expect(state).toEqual(before);
		}
	});
	test("requires an authenticated admin before database access", async () => {
		for (const [user, status] of [
			[undefined, 401],
			[{ id: "reader", role: "user" }, 403],
		] as const) {
			const session = {
				api: { getSession: async () => (user === undefined ? null : { user }) },
			} as never;
			const response = await modifyShow({} as never, editPayload, session);
			expect(response.statusCode).toBe(status);
		}
	});
});

test("creation rejects missing or invalid image variants before writing", async () => {
	const payload = {
		title: "Show",
		date: "2026-01-01",
		duration: 60,
		url: "https://example.test/show",
		djs: [1],
		image_small: "https://example.test/small",
		image_large: "https://example.test/large",
	};
	for (const key of ["image_small", "image_large"])
		for (const value of [
			undefined,
			null,
			"",
			" ",
			"relative.jpg",
			"ftp://example.test/image",
		]) {
			const { database, state } = buildDatabase();
			const before = structuredClone(state);
			expect(
				(await createShow(database, { ...payload, [key]: value })).statusCode,
			).toBe(400);
			expect(state).toEqual(before);
		}
});

test("import requests require an authenticated admin before database access", async () => {
	for (const [user, status] of [
		[undefined, 401],
		[{ id: "reader", role: "user" }, 403],
	] as const) {
		const app = Fastify({ logger: false });
		await app.register(
			adminRoutes(
				{
					api: {
						getSession: async () => (user === undefined ? null : { user }),
					},
				} as never,
				{} as never,
				{ username: "", password: "" },
			),
		);
		try {
			const response = await app.inject({
				method: "POST",
				url: "/api/admin/create-show",
				payload: { mixcloud_import_id: 1 },
			});
			expect(response.statusCode).toBe(status);
		} finally {
			await app.close();
		}
	}
});
