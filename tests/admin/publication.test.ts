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
	mode = "remote",
	busy = false,
	fail = false,
	previewFailure = false,
}: {
	role?: string;
	mode?: "local" | "remote";
	busy?: boolean;
	fail?: boolean;
	previewFailure?: boolean;
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
			return {
				revision: "9007199254740993",
				published_revision: "0",
				published_target: null,
			};
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
			mode: "remote" as const,
			repository: "git@example.com:archive.git",
			checkoutPath: "/tmp/archive",
			branch: "publish-dev",
		},
		stage: "queued" as const,
		outcome: "running" as const,
	};
	const preview = {
		id: "00000000-0000-0000-0000-000000000002",
		revision: "1",
		changes: {
			tags: { added: [], changed: [], removed: [] },
			shows: { added: [], changed: [], removed: [] },
			djs: { added: [], changed: [], removed: [] },
		},
		expiresAt: new Date(Date.now() + 60000).toISOString(),
	};
	const starts: unknown[] = [];
	const previewRequests: unknown[] = [];
	await app.register(
		adminRoutes(auth, database, {
			config:
				mode === "local"
					? { mode, checkoutPath: job.target.checkoutPath }
					: job.target,
			runner: {
				preparePreview: async (request) => {
					previewRequests.push(request);
					if (previewFailure) throw new Error("private repository credentials");
					return preview;
				},
				start: async (request) => {
					starts.push(request);
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
		preview,
		starts,
		previewRequests,
		revoke: () => {
			activeRole = "editor";
		},
	};
};
describe("publication routes", () => {
	test("prepares an owned preview and forwards its ID when publishing", async () => {
		const { app, preview, previewRequests, starts } = await setup();
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/publication/preview",
			payload: {},
		});
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(preview);
		expect(previewRequests).toEqual([{ requestedBy: "actor" }]);
		expect(response.headers["cache-control"]).toBe("private, no-store");
		await app.inject({
			method: "POST",
			url: "/api/admin/publication",
			payload: { previewId: preview.id },
		});
		expect(starts).toEqual([{ requestedBy: "actor", previewId: preview.id }]);
	});
	test("rejects invalid preview requests", async () => {
		const { app, preview } = await setup();
		for (const payload of [
			[],
			{ previewId: preview.id },
			{ retryJobId: "invalid" },
			{ unexpected: true },
		])
			expect(
				(
					await app.inject({
						method: "POST",
						url: "/api/admin/publication/preview",
						payload,
					})
				).statusCode,
			).toBe(400);
	});
	test("preview failures return safe actionable errors", async () => {
		const { app } = await setup({ previewFailure: true });
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/publication/preview",
			payload: {},
		});
		expect(response.statusCode).toBe(500);
		expect(response.json().error).toContain("Request ID:");
		expect(response.body).not.toContain("private");
	});

	for (const role of ["anonymous", "editor"])
		test(`${role} cannot prepare previews`, async () => {
			const { app } = await setup({ role });
			expect(
				(
					await app.inject({
						method: "POST",
						url: "/api/admin/publication/preview",
						payload: {},
					})
				).statusCode,
			).toBe(role === "anonymous" ? 401 : 403);
		});
	test("preview preparation rejects cross-origin requests", async () => {
		const { app } = await setup();
		expect(
			(
				await app.inject({
					method: "POST",
					url: "/api/admin/publication/preview",
					headers: { origin: "https://evil.invalid" },
					payload: {},
				})
			).statusCode,
		).toBe(403);
	});

	test("status preserves bigint decimal strings", async () => {
		const { app, job } = await setup();
		const response = await app.inject("/api/admin/publication");
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			mode: "remote",
			target: job.target,
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
	test("local configuration accepts publication starts", async () => {
		const { app } = await setup({ mode: "local" });
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/publication",
			payload: {},
		});
		expect(response.statusCode).toBe(202);
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
