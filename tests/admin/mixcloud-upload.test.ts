import { expect, spyOn, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import sharp from "sharp";
import type { MixcloudIntegration } from "../../src/admin/routes/mixcloud/index.js";
import { uploadMixcloudHandler } from "../../src/admin/routes/mixcloud/routes/upload/upload-mixcloud.js";
// Fixtures are short silent recordings generated with ffmpeg, with no external media.
import { auth } from "../../src/auth/auth.js";

const integration: MixcloudIntegration = {
	client: {
		upload: async () => ({ success: true, statusCode: 200 }),
	} as MixcloudIntegration["client"],
	store: {
		getAccessToken: async () => "test-token",
	} as MixcloudIntegration["store"],
};

const audio = new Uint8Array(
	await Bun.file(
		new URL("./fixtures/silence.mp3", import.meta.url),
	).arrayBuffer(),
);
const temporaryUploads = async () =>
	(await readdir(tmpdir()))
		.filter((name) => name.startsWith("archive-mixcloud-upload-"))
		.sort();

const send = async (
	changes: Record<string, string | undefined> = {},
	bytes = audio,
	filename = "show.mp3",
	extra?: string,
	image?: File,
	imageFirst = false,
) => {
	const app = Fastify();
	await app.register(multipart, { limits: { fileSize: 1 } });
	const session = spyOn(auth.api, "getSession").mockResolvedValue({
		user: { id: "acting-user", role: "editor", mustChangePassword: false },
	} as never);
	app.post("/upload", uploadMixcloudHandler(auth, integration));
	const form = new FormData();
	for (const [name, value] of Object.entries({
		title: "Show",
		mixcloud_title: "DJ - Show",
		date: "2024-02-29",
		tags: '["House"]',
		...changes,
	}))
		if (value !== undefined) form.set(name, value);
	if (imageFirst && image) form.set("image", image);
	form.set("mp3", new File([bytes], filename));
	if (!imageFirst && image) form.set("image", image);
	if (extra) form.append(extra, "duplicate");
	const request = new Request("http://localhost/upload", {
		method: "POST",
		body: form,
	});
	const before = await temporaryUploads();
	try {
		const response = await app.inject({
			method: "POST",
			url: "/upload",
			headers: { "content-type": request.headers.get("content-type") ?? "" },
			payload: Buffer.from(await request.arrayBuffer()),
		});
		expect(response.json()).toEqual({ success: response.statusCode === 200 });
		expect(await temporaryUploads()).toEqual(before);
		return response.statusCode;
	} finally {
		session.mockRestore();
		await app.close();
	}
};

test("streams valid audio despite the smaller global file limit, then cleans up", async () => {
	expect(await send()).toBe(200);
});

test("rejects an ID3 metadata header without audio", async () => {
	expect(
		await send({}, new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0])),
	).toBe(400);
});

test("rejects malformed metadata and cleans up audio", async () => {
	for (const changes of [
		{ title: " " },
		{ mixcloud_title: " " },
		{ mixcloud_title: undefined },
		{ title: undefined },
		{ date: "2025-02-29" },
		{ date: "invalid" },
		{ tags: "{}" },
		{ tags: "not json" },
		{ tags: '[" "]' },
		{ tags: '["a","b","c","d","e","f"]' },
	])
		expect(await send(changes)).toBe(400);
});

test("rejects empty, renamed, or unsupported audio", async () => {
	expect(await send({}, new Uint8Array())).toBe(400);
	expect(await send({}, new Uint8Array([1, 2, 3, 4]))).toBe(400);
	expect(await send({}, audio, "show.wav")).toBe(400);
});

test("rejects duplicate and unexpected fields", async () => {
	// Duplicate and unknown fields are rejected after draining the request.
	expect(await send({}, audio, "show.mp3", "title")).toBe(400);
	expect(await send({ unexpected: "x" })).toBe(400);
});

test("rejects requests without multipart", async () => {
	const app = Fastify();
	await app.register(multipart);
	const session = spyOn(auth.api, "getSession").mockResolvedValue({
		user: { id: "acting-user", role: "editor", mustChangePassword: false },
	} as never);
	app.post("/upload", uploadMixcloudHandler(auth, integration));
	try {
		const result = await app.inject({
			method: "POST",
			url: "/upload",
			payload: {},
		});
		expect(result.statusCode).toBe(400);
	} finally {
		session.mockRestore();
		await app.close();
	}
});

test("rejects WAV audio renamed to MP3", async () => {
	const wav = new Uint8Array(
		await Bun.file(
			new URL("./fixtures/silence.wav", import.meta.url),
		).arrayBuffer(),
	);
	expect(await send({}, wav)).toBe(400);
});

for (const configured of [false, true]) {
	test(`rejects ${configured ? "disconnected" : "unconfigured"} upload before reading audio`, async () => {
		const app = Fastify();
		const session = spyOn(auth.api, "getSession").mockResolvedValue({
			user: { id: "acting-user", role: "editor", mustChangePassword: false },
		} as never);
		const token = spyOn(integration.store, "getAccessToken").mockResolvedValue(
			undefined,
		);
		app.post(
			"/upload",
			uploadMixcloudHandler(auth, configured ? integration : undefined),
		);
		try {
			const result = await app.inject({
				method: "POST",
				url: "/upload",
				payload: {},
			});
			expect(result.statusCode).toBe(configured ? 403 : 503);
			expect(result.json()).toEqual({ success: false });
		} finally {
			token.mockRestore();
			session.mockRestore();
			await app.close();
		}
	});
}

test("uses the acting user's token and never uploads invalid audio", async () => {
	const token = spyOn(integration.store, "getAccessToken").mockResolvedValue(
		"acting-token",
	);
	const provider = spyOn(integration.client, "upload").mockResolvedValue({
		success: true,
		statusCode: 200,
	});
	try {
		expect(await send()).toBe(200);
		expect(token).toHaveBeenCalledWith("acting-user");
		expect(provider.mock.calls[0]?.[0]).toBe("acting-token");
		expect(provider.mock.calls[0]?.[1].title).toBe("DJ - Show");
		provider.mockClear();
		expect(await send({}, new Uint8Array([0, 1, 2]))).toBe(400);
		expect(provider).not.toHaveBeenCalled();
	} finally {
		token.mockRestore();
		provider.mockRestore();
	}
});

test("preserves provider rejection and cleans up the temporary file", async () => {
	const provider = spyOn(integration.client, "upload").mockResolvedValue({
		success: false,
		statusCode: 502,
	});
	try {
		expect(await send()).toBe(502);
	} finally {
		provider.mockRestore();
	}
});

const coverBytes = await sharp({
	create: { width: 1200, height: 1200, channels: 3, background: "red" },
})
	.webp()
	.toBuffer();
const cover = new File([coverBytes], "cover.webp", { type: "image/webp" });

test("passes validated WebP unchanged to the client and cleans up both files", async () => {
	const paths: string[] = [];
	const provider = spyOn(integration.client, "upload").mockImplementation(
		async (_token, upload) => {
			expect(upload.imagePath).toBeDefined();
			if (!upload.imagePath) throw new Error("Expected image path");
			expect(await readFile(upload.imagePath)).toEqual(coverBytes);
			paths.push(upload.path, upload.imagePath);
			return { success: true, statusCode: 200 };
		},
	);
	try {
		for (const first of [false, true])
			expect(await send({}, audio, "show.mp3", undefined, cover, first)).toBe(
				200,
			);
		for (const path of paths) expect(await Bun.file(path).exists()).toBe(false);
	} finally {
		provider.mockRestore();
	}
});

test("rejects invalid artwork without calling the provider", async () => {
	const nonSquare = await sharp({
		create: { width: 1200, height: 600, channels: 3, background: "red" },
	})
		.webp()
		.toBuffer();
	const png = await sharp(coverBytes).png().toBuffer();
	const provider = spyOn(integration.client, "upload");
	try {
		for (const image of [
			new File([], "empty.webp", { type: "image/webp" }),
			new File(["invalid"], "bad.webp", { type: "image/webp" }),
			new File([coverBytes.subarray(0, 100)], "truncated.webp", {
				type: "image/webp",
			}),
			new File([nonSquare], "wide.webp", { type: "image/webp" }),
			new File([png], "disguised.webp", { type: "image/webp" }),
			new File([coverBytes], "cover.png", { type: "image/webp" }),
			new File([coverBytes], "cover.webp", { type: "image/png" }),
		])
			expect(await send({}, audio, "show.mp3", undefined, image)).toBe(400);
		expect(await send({}, audio, "show.mp3", "image", cover)).toBe(400);
		expect(provider).not.toHaveBeenCalled();
	} finally {
		provider.mockRestore();
	}
});

test("enforces image byte limit while streaming and cleans up", async () => {
	const provider = spyOn(integration.client, "upload");
	try {
		const image = new File([new Uint8Array(10_000_001)], "huge.webp", {
			type: "image/webp",
		});
		expect(await send({}, audio, "show.mp3", undefined, image)).toBe(413);
		expect(provider).not.toHaveBeenCalled();
	} finally {
		provider.mockRestore();
	}
});

test("cleans up artwork on provider failure", async () => {
	const provider = spyOn(integration.client, "upload").mockResolvedValue({
		success: false,
		statusCode: 502,
	});
	try {
		expect(await send({}, audio, "show.mp3", undefined, cover)).toBe(502);
	} finally {
		provider.mockRestore();
	}
});

test("forwards optional description verbatim and rejects oversized descriptions", async () => {
	const provider = spyOn(integration.client, "upload").mockResolvedValue({
		success: true,
		statusCode: 200,
	});
	try {
		for (const description of [
			"",
			"Line one\nLine two",
			"x".repeat(1000),
			"a\n".repeat(500),
		]) {
			expect(await send({ description })).toBe(200);
			expect(provider.mock.calls.at(-1)?.[1].description).toBe(description);
		}
		provider.mockClear();
		expect(await send({ description: "x".repeat(1001) })).toBe(400);
		expect(provider).not.toHaveBeenCalled();
		expect(
			await send({ description: "test" }, audio, "show.mp3", "description"),
		).toBe(400);
	} finally {
		provider.mockRestore();
	}
});
