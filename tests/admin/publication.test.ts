import { afterEach, describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";
import { PublicationBusyError } from "../../src/publication/index.js";

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
	for (const app of apps) await app.close();
	apps.length = 0;
});
const setup = async ({
	role = "admin",
	enabled = true,
	busy = false,
	fail = false,
}: {
	role?: string;
	enabled?: boolean;
	busy?: boolean;
	fail?: boolean;
} = {}) => {
	let activeRole = role;
	const auth = {
		api: {
			getSession: async () =>
				activeRole === "anonymous"
					? null
					: { user: { id: "actor", role: activeRole } },
		},
	} as never;
	const query = {
		select: () => query,
		selectAll: () => query,
		where: () => query,
		orderBy: () => query,
		limit: () => query,
		executeTakeFirstOrThrow: async () => {
			if (fail) throw new Error("private database error");
			return { revision: "9007199254740993", published_revision: "0" };
		},
		executeTakeFirst: async () => undefined,
	};
	const transaction = {
		setIsolationLevel: () => transaction,
		setAccessMode: () => transaction,
		execute: async (callback: (database: unknown) => unknown) =>
			callback(database),
	};
	const database = {
		transaction: () => transaction,
		selectFrom: () => query,
	} as never;
	const app = Fastify();
	apps.push(app);
	const job = {
		id: "00000000-0000-0000-0000-000000000001",
		createdAt: new Date().toISOString(),
		requestedBy: "actor",
		target: {
			repository: "git@example.com:archive.git",
			checkoutPath: "/tmp/archive",
			branch: "publish-dev",
		},
		stage: "queued" as const,
		outcome: "running" as const,
	};
	await app.register(
		adminRoutes(auth, database, {
			config: { enabled, ...job.target },
			runner: {
				start: async () => {
					if (busy) throw new PublicationBusyError();
					return job;
				},
				close: async () => {},
			},
			notifications: { subscribe: () => () => {}, close: async () => {} },
		}),
	);
	return {
		app,
		job,
		revoke: () => {
			activeRole = "editor";
		},
	};
};
describe("publication routes", () => {
	test("status preserves bigint decimal strings", async () => {
		const { app } = await setup();
		const response = await app.inject("/api/admin/publication");
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			enabled: true,
			branch: "publish-dev",
			revision: "9007199254740993",
			publishedRevision: "0",
			pending: true,
		});
	});
	test("event stream immediately sends durable status and closes on disconnect", async () => {
		const { app } = await setup();
		const url = await app.listen({ host: "127.0.0.1", port: 0 });
		const controller = new AbortController();
		const response = await fetch(`${url}/api/admin/publication/events`, {
			signal: controller.signal,
		});
		expect(response.headers.get("content-type")).toBe("text/event-stream");
		const reader = response.body?.getReader();
		expect(reader).toBeDefined();
		const chunk = await reader?.read();
		expect(new TextDecoder().decode(chunk?.value)).toContain('"type":"status"');
		expect(new TextDecoder().decode(chunk?.value)).toContain(
			'"revision":"9007199254740993"',
		);
		controller.abort();
	});

	test("an open event stream ends when administrator access is revoked", async () => {
		const { app, revoke } = await setup();
		const url = await app.listen({ host: "127.0.0.1", port: 0 });
		const response = await fetch(`${url}/api/admin/publication/events`);
		const reader = response.body?.getReader();
		await reader?.read();
		revoke();
		expect((await reader?.read())?.done).toBe(true);
	});

	test("server shutdown closes active event streams", async () => {
		const { app } = await setup();
		const url = await app.listen({ host: "127.0.0.1", port: 0 });
		const response = await fetch(`${url}/api/admin/publication/events`);
		const reader = response.body?.getReader();
		await reader?.read();
		await app.close();
		expect((await reader?.read())?.done).toBe(true);
	});

	test("starts a durable job with accepted response", async () => {
		const { app, job } = await setup();
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/publication",
			payload: {},
		});
		expect(response.statusCode).toBe(202);
		expect(response.json()).toEqual(job);
	});
	test("rejects concurrent starts", async () => {
		const { app } = await setup({ busy: true });
		expect(
			(
				await app.inject({
					method: "POST",
					url: "/api/admin/publication",
					payload: {},
				})
			).statusCode,
		).toBe(409);
	});
	test("disabled configuration rejects starts", async () => {
		const { app } = await setup({ enabled: false });
		expect(
			(
				await app.inject({
					method: "POST",
					url: "/api/admin/publication",
					payload: {},
				})
			).statusCode,
		).toBe(503);
	});
	test("rejects invalid request bodies and job identifiers", async () => {
		const { app } = await setup();
		for (const payload of [{ retryJobId: 12 }, { unexpected: true }, []])
			expect(
				(
					await app.inject({
						method: "POST",
						url: "/api/admin/publication",
						payload,
					})
				).statusCode,
			).toBe(400);
		expect(
			(await app.inject("/api/admin/publication/jobs/invalid")).statusCode,
		).toBe(400);
	});
	test("unknown jobs return 404", async () => {
		const { app } = await setup();
		expect(
			(
				await app.inject(
					"/api/admin/publication/jobs/00000000-0000-0000-0000-000000000001",
				)
			).statusCode,
		).toBe(404);
	});
	test("unexpected failures hide database details", async () => {
		const { app } = await setup({ fail: true });
		const response = await app.inject("/api/admin/publication");
		expect(response.statusCode).toBe(500);
		expect(response.json().error).toContain(
			"Could not load publication status. Reload status",
		);
		expect(response.json().error).toContain("Request ID:");
	});
	for (const role of ["editor", "anonymous"])
		test(`${role} cannot access any publication endpoint`, async () => {
			const { app } = await setup({ role });
			for (const url of [
				"/api/admin/publication",
				"/api/admin/publication/jobs/any",
				"/api/admin/publication/events",
			])
				expect((await app.inject(url)).statusCode).toBe(
					role === "anonymous" ? 401 : 403,
				);
			expect(
				(
					await app.inject({
						method: "POST",
						url: "/api/admin/publication",
						payload: {},
					})
				).statusCode,
			).toBe(role === "anonymous" ? 401 : 403);
		});
	test("shared origin guard rejects cross-origin starts", async () => {
		const { app } = await setup();
		expect(
			(
				await app.inject({
					method: "POST",
					url: "/api/admin/publication",
					headers: { origin: "https://evil.invalid" },
					payload: {},
				})
			).statusCode,
		).toBe(403);
	});
});
