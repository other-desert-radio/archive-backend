import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
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
			expect(body.has("description")).toBe(false);
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
	if (result.success) expect(result.key).toMatch(/^\/[^/]+\/[^/]+\/$/);
	expect(result.statusCode).toBe(200);
});

test("forwards optional WebP artwork unchanged as picture", async () => {
	const directory = await mkdtemp(join(tmpdir(), "mixcloud-picture-test-"));
	try {
		const bytes = await sharp({
			create: { width: 1200, height: 1200, channels: 3, background: "red" },
		})
			.webp()
			.toBuffer();
		const imagePath = join(directory, "image.webp");
		await writeFile(imagePath, bytes);
		const result = await uploadToMixcloud(
			"private-token",
			{ ...upload, imagePath, description: "Line one\nLine two" },
			async (_url, options) => {
				const body = options.body;
				if (!(body instanceof FormData)) throw new Error("Expected multipart");
				const multipart = await new Request("http://localhost/upload", {
					method: "POST",
					body,
				}).formData();
				const picture = multipart.get("picture");
				if (!(picture instanceof File))
					throw new Error("Expected picture file");
				expect(body.get("description")).toBe("Line one\nLine two");
				expect(multipart.get("description")).toBe("Line one\r\nLine two");
				expect(picture.name).toBe("cover.webp");
				expect(picture.type).toBe("image/webp");
				expect(Buffer.from(await picture.arrayBuffer())).toEqual(bytes);
				expect(body.get("mp3")).toBeInstanceOf(Blob);
				expect(body.get("name")).toBe("Show");
				expect(body.get("tags-1-tag")).toBe("Disco");
				return Response.json({ result: { success: true, key: "/odr/show/" } });
			},
		);
		expect(result.success).toBe(true);
		if (result.success) expect(result.key).toMatch(/^\/[^/]+\/[^/]+\/$/);
		expect(result.statusCode).toBe(200);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

for (const { status, body, expected } of [
	...[
		undefined,
		"",
		"/odr/",
		"https://evil.test/show/",
		"//evil.test/",
		"/odr/../",
		"/odr/show/?secret=x",
	].map((key) => ({
		status: 200,
		body: { result: { success: true, key } },
		expected: 502,
	})),
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
