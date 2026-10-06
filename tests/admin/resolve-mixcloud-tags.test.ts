import { expect, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";

const tags = [
	{ id: 1, title: "Ambient", color: "#aabbcc", mixcloud_key: "/ambient/" },
	{ id: 2, title: "Duplicate", color: "#ffffff", mixcloud_key: "/duplicate/" },
	{ id: 3, title: "Other", color: "#000000", mixcloud_key: "/duplicate/" },
];
const auth = (role?: string) =>
	({
		api: {
			getSession: async () => (role ? { user: { id: "test", role } } : null),
		},
	}) as never;
const database = {
	selectFrom: () => ({ select: () => ({ execute: async () => tags }) }),
} as never;

test("resolves canonical tags, deduplicates keys, and rejects missing, ambiguous and nonexact keys", async () => {
	const app = Fastify();
	try {
		await app.register(adminRoutes(auth("admin"), database));
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/validate-tags",
			payload: {
				mixcloud_keys: [
					"/ambient/",
					"/missing/",
					"/ambient/",
					"/duplicate/",
					"/AMBIENT/",
					" /ambient/ ",
				],
			},
		});
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			valid: [
				{
					key: "/ambient/",
					tag: { id: 1, title: "Ambient", color: "#aabbcc" },
				},
			],
			invalid: ["/missing/", "/duplicate/", "/AMBIENT/", " /ambient/ "],
		});
		const empty = await app.inject({
			method: "POST",
			url: "/api/admin/validate-tags",
			payload: { mixcloud_keys: [] },
		});
		expect(empty.json()).toEqual({ valid: [], invalid: [] });
		for (const payload of [
			{ tags: [], mixcloud_keys: [] },
			{ mixcloud_keys: [1] },
			{ mixcloud_keys: "bad" },
			{},
		]) {
			expect(
				(
					await app.inject({
						method: "POST",
						url: "/api/admin/validate-tags",
						payload,
					})
				).statusCode,
			).toBe(400);
		}
	} finally {
		await app.close();
	}
});

for (const [role, status] of [
	[undefined, 401],
	["user", 403],
] as const) {
	test(`key resolution requires admin access: ${status}`, async () => {
		const app = Fastify();
		try {
			await app.register(adminRoutes(auth(role), database));
			expect(
				(
					await app.inject({
						method: "POST",
						url: "/api/admin/validate-tags",
						payload: { mixcloud_keys: [] },
					})
				).statusCode,
			).toBe(status);
		} finally {
			await app.close();
		}
	});
}

test("key resolution returns a generic error on database failure", async () => {
	const app = Fastify();
	try {
		await app.register(
			adminRoutes(auth("admin"), {
				selectFrom: () => {
					throw new Error("private database detail");
				},
			} as never),
		);
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/validate-tags",
			payload: { mixcloud_keys: ["/ambient/"] },
		});
		expect(response.statusCode).toBe(500);
		expect(response.json()).toEqual({ error: "Internal Server Error" });
	} finally {
		await app.close();
	}
});
