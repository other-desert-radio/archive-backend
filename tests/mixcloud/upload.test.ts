import { expect, test } from "bun:test";
import { uploadToMixcloud } from "../../src/mixcloud/upload.js";

const upload = {
	title: "Show",
	tags: ["House", "Disco"],
	path: new URL("../admin/fixtures/silence.mp3", import.meta.url).pathname,
};

test("sends disk-backed multipart audio and names, without date or artwork", async () => {
	const result = await uploadToMixcloud(
		"private-token",
		upload,
		async (url, options) => {
			expect(url.origin + url.pathname).toBe(
				"https://api.mixcloud.com/upload/",
			);
			expect(url.searchParams.get("access_token")).toBe("private-token");
			expect(options.redirect).toBe("error");
			expect(options.method).toBe("POST");
			const body = options.body;
			if (!(body instanceof FormData)) throw new Error("Expected multipart");
			expect(body.get("name")).toBe("Show");
			expect(body.get("tags-1-tag")).toBe("Disco");
			expect(body.has("picture")).toBe(false);
			expect(body.has("publish_date")).toBe(false);
			const audio = body.get("mp3");
			if (!(audio instanceof Blob)) throw new Error("Expected audio blob");
			expect(audio.size).toBe(957);
			expect((await audio.arrayBuffer()).byteLength).toBe(957);
			return Response.json({
				result: {
					success: true,
					message: "Uploaded My first show!",
					key: "/garrepi/my-first-show/",
				},
			});
		},
	);
	expect(result.success).toBe(true);
	expect(result.statusCode).toBe(200);
});

for (const { status, body, expected } of [
	{ status: 200, body: { success: false }, expected: 502 },
	{ status: 200, body: { result: { success: false } }, expected: 502 },
	{ status: 200, body: { result: { success: "true" } }, expected: 502 },
	{ status: 200, body: { success: true }, expected: 502 },
	{
		status: 200,
		body: { result: { success: true, error: "bad" } },
		expected: 502,
	},
	{
		status: 200,
		body: { result: { success: true }, error: "bad" },
		expected: 502,
	},
	{ status: 500, body: { result: { success: true } }, expected: 502 },
	{ status: 200, body: { unexpected: true }, expected: 502 },
	{ status: 200, body: { success: true, error: "bad" }, expected: 502 },
	{ status: 401, body: { error: "invalid token" }, expected: 403 },
	{ status: 429, body: { error: "limit" }, expected: 429 },
	{ status: 500, body: { error: "failed" }, expected: 502 },
]) {
	test(`maps provider ${status}/${JSON.stringify(body)} safely`, async () => {
		const result = await uploadToMixcloud("private-token", upload, async () =>
			Response.json(body, { status }),
		);
		expect(result.success).toBe(false);
		expect(result.statusCode).toBe(expected);
		expect(result.responseBody).toBe(JSON.stringify(body));
	});
}

test("logs full response with token and credential fields redacted", async () => {
	const result = await uploadToMixcloud("private-token", upload, async () =>
		Response.json({
			success: true,
			access_token: "different-token",
			nested: { client_secret: "secret" },
			message: "private-token",
		}),
	);
	expect(result.responseBody).not.toContain("private-token");
	expect(result.responseBody).not.toContain("different-token");
	expect(result.responseBody).not.toContain('"secret"');
	expect(result.responseBody).toContain('"success":true');
});

test("does not retry or expose token-bearing network errors", async () => {
	let calls = 0;
	const result = await uploadToMixcloud("private-token", upload, async () => {
		calls++;
		throw new Error("private-token in URL");
	});
	expect(calls).toBe(1);
	expect(result).toEqual({ success: false, statusCode: 502 });
});

test("handles non-JSON responses and provider rate-limit headers", async () => {
	const result = await uploadToMixcloud(
		"private-token",
		upload,
		async () =>
			new Response("private-token rejected", {
				status: 403,
				headers: { "retry-after": "60" },
			}),
	);
	expect(result.statusCode).toBe(429);
	expect(result.responseBody).toBe("[REDACTED] rejected");
});

test("maps provider timeout without retrying", async () => {
	const result = await uploadToMixcloud("private-token", upload, async () => {
		throw new DOMException("private-token", "TimeoutError");
	});
	expect(result).toEqual({ success: false, statusCode: 504 });
});
