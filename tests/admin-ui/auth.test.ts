import { afterAll, afterEach, expect, spyOn, test } from "bun:test";
import { apiFetch } from "../../src/admin-ui/loaders/api-fetch.js";
import { authRequest, loadSession } from "../../src/admin-ui/loaders/auth.js";

const fetchSpy = spyOn(globalThis, "fetch");
afterEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());
test("session lookup distinguishes signed out and password-change-required accounts", async () => {
	fetchSpy.mockResolvedValueOnce(Response.json(null));
	expect(await loadSession()).toBeUndefined();
	const user = {
		id: "one",
		email: "editor@example.com",
		role: "editor",
		mustChangePassword: true,
	};
	fetchSpy.mockResolvedValueOnce(Response.json({ user }));
	expect(await loadSession()).toEqual(user);
});
test("session lookup explains network failures without exposing transport details", async () => {
	fetchSpy.mockRejectedValueOnce(new Error("private transport detail"));
	await expect(loadSession()).rejects.toThrow(
		"Unable to reach the sign-in service. Check your connection and retry.",
	);
});
test("session errors include HTTP status and a safe request reference without response bodies", async () => {
	for (const status of [401, 403, 404, 500, 502]) {
		fetchSpy.mockResolvedValueOnce(
			new Response("private upstream details", {
				status,
				headers: { "x-request-id": "req-test" },
			}),
		);
		await expect(loadSession()).rejects.toThrow(
			`The sign-in service could not check your session. Retry; if this continues, contact the administrator. (HTTP ${status}; reference req-test)`,
		);
	}
	fetchSpy.mockResolvedValueOnce(new Response("", { status: 429 }));
	await expect(loadSession()).rejects.toThrow(
		"Too many session checks. Wait a minute, then retry. (HTTP 429)",
	);
});
test("session lookup rejects proxy HTML and malformed successful payloads", async () => {
	fetchSpy.mockResolvedValueOnce(new Response("<html>proxy page</html>"));
	await expect(loadSession()).rejects.toThrow("unreadable response");
	for (const body of [
		{},
		{ user: {} },
		{
			user: {
				id: "one",
				email: "editor@example.com",
				role: "unexpected",
				mustChangePassword: false,
			},
		},
	]) {
		fetchSpy.mockResolvedValueOnce(Response.json(body));
		await expect(loadSession()).rejects.toThrow("unexpected response");
	}
});
test("auth mutations submit JSON and preserve actionable server errors", async () => {
	fetchSpy.mockResolvedValueOnce(
		Response.json({ error: "Password does not meet policy" }, { status: 400 }),
	);
	await expect(
		authRequest("/api/account/change-password", {
			currentPassword: "old",
			newPassword: "new",
		}),
	).rejects.toThrow("Password does not meet policy");
	expect(fetchSpy.mock.lastCall?.[1]).toMatchObject({
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ currentPassword: "old", newPassword: "new" }),
	});
});
test("shared fetch preserves error bodies and works outside a browser", async () => {
	for (const status of [401, 403]) {
		fetchSpy.mockResolvedValueOnce(
			Response.json(
				{ error: "Forbidden", code: "PASSWORD_CHANGE_REQUIRED" },
				{ status },
			),
		);
		const response = await apiFetch("/api/admin/users");
		expect(response.status).toBe(status);
		expect(await response.json()).toMatchObject({
			code: "PASSWORD_CHANGE_REQUIRED",
		});
	}
});
test("shared fetch announces expiry and only the required-password 403", async () => {
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
	const events = new EventTarget();
	const received: string[] = [];
	events.addEventListener("auth:expired", () => received.push("expired"));
	events.addEventListener("auth:password-required", () =>
		received.push("password"),
	);
	Object.defineProperty(globalThis, "window", {
		value: events,
		configurable: true,
	});
	try {
		for (const [status, body] of [
			[401, { error: "Unauthorized" }],
			[403, { error: "Forbidden" }],
			[403, { code: "PASSWORD_CHANGE_REQUIRED" }],
		] as const) {
			fetchSpy.mockResolvedValueOnce(Response.json(body, { status }));
			const response = await apiFetch("/api/admin/users");
			expect(await response.json()).toEqual(body);
		}
		expect(received).toEqual(["expired", "password"]);
	} finally {
		if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
		else Reflect.deleteProperty(globalThis, "window");
	}
});
