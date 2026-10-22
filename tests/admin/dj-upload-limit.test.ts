import { afterEach, describe, expect, mock, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";
import { multipartPayload } from "./multipart-test-utils.js";

const adminSession = {
	api: {
		getSession: async () => ({
			user: { id: "admin-user", role: "admin" },
		}),
	},
} as never;

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
	for (const app of apps.splice(0)) await app.close();
});

describe("DJ upload limit", () => {
	for (const route of ["create-dj", "modify-dj"]) {
		for (const contentType of ["image/webp", "application/octet-stream"]) {
			test(`${route} rejects oversized ${contentType} before database access`, async () => {
				const transaction = mock(() => {
					throw new Error("Unexpected database access");
				});
				const app = Fastify({ logger: false });
				apps.push(app);
				await app.register(adminRoutes(adminSession, { transaction } as never));
				const response = await app.inject({
					method: "POST",
					url: `/api/admin/${route}`,
					...(await multipartPayload({
						...(route === "modify-dj"
							? { id: "42", removeImage: "false" }
							: {}),
						title: "DJ",
						bio: "Bio",
						image: new File([new Uint8Array(10 * 1024 * 1024 + 1)], "dj.webp", {
							type: contentType,
						}),
					})),
				});
				expect(response.statusCode).toBe(413);
				expect(response.json()).toEqual({
					error: "Image must not exceed 10 MiB",
				});
				expect(transaction).not.toHaveBeenCalled();
			});
		}

		test(`${route} accepts exactly 10 MiB through multipart parsing`, async () => {
			const transaction = mock(() => {
				throw new Error("Unexpected database access");
			});
			const app = Fastify({ logger: false });
			apps.push(app);
			await app.register(adminRoutes(adminSession, { transaction } as never));
			const response = await app.inject({
				method: "POST",
				url: `/api/admin/${route}`,
				...(await multipartPayload({
					...(route === "modify-dj" ? { id: "42", removeImage: "false" } : {}),
					title: "DJ",
					bio: "Bio",
					image: new File([new Uint8Array(10 * 1024 * 1024)], "dj.bin", {
						type: "application/octet-stream",
					}),
				})),
			});
			// MIME validation happens after parsing, proving the size boundary passed.
			expect(response.statusCode).toBe(400);
			expect(response.json().error).toBe(
				"Image must have a JPEG, PNG, or WebP MIME type",
			);
			expect(transaction).not.toHaveBeenCalled();
		});
	}
});
