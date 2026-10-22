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

const submit = async (
	route: string,
	database: never,
	fields: Record<string, string>,
) => {
	const app = Fastify({ logger: false });
	apps.push(app);
	await app.register(adminRoutes(adminSession, database));
	return app.inject({
		method: "POST",
		url: `/api/admin/${route}`,
		...(await multipartPayload({
			...(route === "modify-dj"
				? { id: "42", removeImage: "false", tags: "" }
				: {}),
			title: "DJ",
			bio: "Bio",
			...fields,
		})),
	});
};

describe("required DJ text", () => {
	for (const route of ["create-dj", "modify-dj"])
		for (const field of ["title", "bio"])
			for (const blank of ["", " \t\n\r ", "\u00a0\u2003"])
				test(`${route} rejects blank ${field}: ${JSON.stringify(blank)}`, async () => {
					const transaction = mock(() => {
						throw new Error("Unexpected database write");
					});
					const response = await submit(route, { transaction } as never, {
						[field]: blank,
					});
					expect(response.statusCode).toBe(400);
					expect(response.json()).toEqual({ error: "Validation error" });
					expect(transaction).not.toHaveBeenCalled();
				});

	test("editing saves trimmed title and biography", async () => {
		const set = mock((values: Record<string, unknown>) => {
			return {
				where: () => ({
					returning: () => ({
						executeTakeFirst: async () => ({
							id: 42,
							createdAt: new Date("2026-01-01"),
							image_small: null,
							image_large: null,
							...values,
						}),
					}),
				}),
			};
		});
		const query = {
			select: () => query,
			where: () => query,
			orderBy: () => query,
			innerJoin: () => query,
			execute: async () => [],
		};
		const database = {
			transaction: () => ({
				execute: async (callback: (transaction: unknown) => Promise<unknown>) =>
					callback({
						updateTable: () => ({ set }),
						deleteFrom: () => query,
						selectFrom: () => query,
					}),
			}),
		} as never;
		const response = await submit("modify-dj", database, {
			title: " \tDJ Updated\n ",
			bio: " \nUpdated bio\t ",
		});
		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			title: "DJ Updated",
			bio: "<p>Updated bio</p>",
		});
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "DJ Updated",
				bio: "<p>Updated bio</p>",
			}),
		);
	});
});
