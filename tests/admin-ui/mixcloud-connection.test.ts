import { afterAll, afterEach, expect, spyOn, test } from "bun:test";
import {
	connectMixcloud,
	disconnectMixcloud,
	loadMixcloudConnection,
} from "../../src/admin-ui/loaders/mixcloud-connection.js";

const fetchSpy = spyOn(globalThis, "fetch");
afterEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());

test("loads all connection states without caching", async () => {
	for (const status of [
		{ configured: false, connected: false },
		{ configured: true, connected: false },
		{
			configured: true,
			connected: true,
			account: { key: "/station/", displayName: "Station" },
		},
	]) {
		fetchSpy.mockResolvedValueOnce(Response.json(status));
		expect(await loadMixcloudConnection()).toEqual(status);
	}
	expect(fetchSpy).toHaveBeenLastCalledWith("/api/admin/mixcloud/status", {
		method: "GET",
		cache: "no-store",
	});
});

test("rejects malformed status and contradictory connection states", async () => {
	for (const status of [
		{},
		{ configured: false, connected: true },
		{ configured: true, connected: true },
		{
			configured: true,
			connected: true,
			account: { key: "/user/show/", displayName: "Show" },
		},
	]) {
		fetchSpy.mockResolvedValueOnce(Response.json(status));
		await expect(loadMixcloudConnection()).rejects.toThrow(
			"Unable to read your Mixcloud connection",
		);
	}
});

test("connect posts and accepts only the Mixcloud consent destination", async () => {
	const url =
		"https://www.mixcloud.com/oauth/authorize?client_id=test&state=random";
	fetchSpy.mockResolvedValueOnce(Response.json({ authorizationUrl: url }));
	expect(await connectMixcloud()).toBe(url);
	expect(fetchSpy).toHaveBeenLastCalledWith("/api/admin/mixcloud/connect", {
		method: "POST",
		cache: "no-store",
	});
	for (const authorizationUrl of [
		"https://attacker.example/",
		"javascript:alert(1)",
		"http://www.mixcloud.com/oauth/authorize",
		"https://www.mixcloud.com/other",
		"https://user:password@www.mixcloud.com/oauth/authorize",
	]) {
		fetchSpy.mockResolvedValueOnce(Response.json({ authorizationUrl }));
		await expect(connectMixcloud()).rejects.toThrow(
			"Unable to start Mixcloud sign-in",
		);
	}
});

test("disconnect posts and requires explicit confirmation", async () => {
	fetchSpy.mockResolvedValueOnce(Response.json({ disconnected: true }));
	await disconnectMixcloud();
	expect(fetchSpy).toHaveBeenLastCalledWith("/api/admin/mixcloud/disconnect", {
		method: "POST",
		cache: "no-store",
	});
	fetchSpy.mockResolvedValueOnce(Response.json({ disconnected: false }));
	await expect(disconnectMixcloud()).rejects.toThrow(
		"Unable to confirm Mixcloud sign-out",
	);
});

test("network, HTTP and unreadable responses use safe actionable errors", async () => {
	for (const run of [
		loadMixcloudConnection,
		connectMixcloud,
		disconnectMixcloud,
	]) {
		fetchSpy.mockRejectedValueOnce(new Error("private network details"));
		await expect(run()).rejects.toThrow("Please try again.");
		fetchSpy.mockResolvedValueOnce(
			new Response("private server details", { status: 500 }),
		);
		await expect(run()).rejects.toThrow("Please try again.");
		fetchSpy.mockResolvedValueOnce(new Response("<html>proxy page</html>"));
		await expect(run()).rejects.toThrow("Please try again.");
	}
});
