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

const buildDatabase = (imageLarge: Buffer | null) => {
	const query = {
		select: () => query,
		where: () => query,
		executeTakeFirst: async () => ({ image_large: imageLarge }),
	};

	return { selectFrom: () => query } as never;
};

describe("DJ image route", () => {
	test("serves the stored large WebP image", async () => {
		const app = Fastify({ logger: false });
		await app.register(
			adminRoutes(adminSession, buildDatabase(Buffer.from("image bytes"))),
		);

		const response = await app.inject({
			method: "GET",
			url: "/api/admin/djs/42/image",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("image/webp");
		expect(response.body).toBe("image bytes");
		await app.close();
	});

	test("returns not found when the DJ has no image", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, buildDatabase(null)));

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
				buildDatabase(Buffer.from("image bytes")),
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
