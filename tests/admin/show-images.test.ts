import { expect, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect } from "kysely";
import { adminRoutes } from "../../src/admin/admin.js";
import { showRoutes } from "../../src/admin/routes/shows/index.js";
import type { Database } from "../../src/db/types.js";

for (const hasImages of [false, true]) {
	test(`show list exposes image links only for stored pairs (${hasImages}) without reading bytes`, async () => {
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
			has_images: hasImages,
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
					...(hasImages
						? {
								image_small: "/api/admin/shows/42/image/small",
								image_large: "/api/admin/shows/42/image/large",
							}
						: {}),
				},
			]);
			expect(queries[0]).toContain(
				'image_small is not null and image_large is not null as "has_images"',
			);
			expect(queries[0]).not.toMatch(/select .*"image_small"/);
			expect(queries[0]).not.toMatch(/select .*"image_large"/);
		} finally {
			await app.close();
			await db.destroy();
		}
	});
}

test("stored Show image links serve authenticated WebP variants and handle missing/invalid images and failures", async () => {
	let row:
		| { image_small: Buffer | null; image_large: Buffer | null }
		| undefined = {
		image_small: Buffer.from("small-webp"),
		image_large: Buffer.from("large-webp"),
	};
	let fail = false;
	let signedIn = true;
	let role = "admin";
	const query = {
		select: () => query,
		where: () => query,
		executeTakeFirst: async () => {
			if (fail) throw new Error("private database failure");
			return row;
		},
	};
	const app = Fastify({ logger: false });
	try {
		await app.register(
			adminRoutes(
				{
					api: {
						getSession: async () =>
							signedIn ? { user: { id: "test-admin", role } } : null,
					},
				} as never,
				{ selectFrom: () => query } as never,
			),
		);
		for (const variant of ["small", "large"]) {
			const response = await app.inject(`/api/admin/shows/42/image/${variant}`);
			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/webp");
			expect(response.body).toBe(`${variant}-webp`);
		}
		for (const path of [
			"0/image/small",
			"-1/image/small",
			"1.5/image/small",
			"NaN/image/small",
			"9007199254740992/image/small",
			"42/image/original",
		]) {
			expect((await app.inject(`/api/admin/shows/${path}`)).statusCode).toBe(
				404,
			);
		}
		row = { image_small: null, image_large: null };
		expect(
			(await app.inject("/api/admin/shows/42/image/small")).statusCode,
		).toBe(404);
		row = undefined;
		expect(
			(await app.inject("/api/admin/shows/42/image/large")).statusCode,
		).toBe(404);
		fail = true;
		const failure = await app.inject("/api/admin/shows/42/image/large");
		expect(failure.statusCode).toBe(500);
		expect(failure.json()).toEqual({ error: "Internal Server Error" });
		signedIn = false;
		expect(
			(await app.inject("/api/admin/shows/42/image/large")).statusCode,
		).toBe(401);
		signedIn = true;
		role = "user";
		expect(
			(await app.inject("/api/admin/shows/42/image/large")).statusCode,
		).toBe(403);
	} finally {
		await app.close();
	}
});
