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

const buildDatabase = (image: Buffer | null, filename: string | null) => {
	const query = {
		select: () => query,
		where: () => query,
		executeTakeFirst: async () => ({ image, image_filename: filename }),
	};

	return { selectFrom: () => query } as never;
};

describe("DJ image route", () => {
	test("serves stored image bytes with the matching content type", async () => {
		const app = Fastify({ logger: false });
		await app.register(
			adminRoutes(
				adminSession,
				buildDatabase(Buffer.from("image bytes"), "dj.png"),
			),
		);

		const response = await app.inject({
			method: "GET",
			url: "/api/admin/djs/42/image",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("image/png");
		expect(response.body).toBe("image bytes");
		await app.close();
	});

	test("returns not found when the DJ has no image", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, buildDatabase(null, null)));

		const response = await app.inject({
			method: "GET",
			url: "/api/admin/djs/42/image",
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toEqual({ error: "Not Found" });
		await app.close();
	});

	test("protects the image route with the admin boundary", async () => {
		const app = Fastify({ logger: false });
		await app.register(
			adminRoutes(
				{
					api: { getSession: async () => null },
				} as never,
				buildDatabase(Buffer.from("image bytes"), "dj.png"),
			),
		);

		const response = await app.inject({
			method: "GET",
			url: "/api/admin/djs/42/image",
		});

		expect(response.statusCode).toBe(401);
		await app.close();
	});
});
