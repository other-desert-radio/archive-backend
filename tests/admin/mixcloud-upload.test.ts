import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { uploadMixcloudHandler } from "../../src/admin/routes/mixcloud/routes/upload-mixcloud.js";

// Fixtures are short silent recordings generated with ffmpeg, with no external media.
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
	changes: Record<string, string> = {},
	bytes = audio,
	filename = "show.mp3",
	extra?: string,
) => {
	const app = Fastify();
	await app.register(multipart, { limits: { fileSize: 1 } });
	app.post("/upload", uploadMixcloudHandler);
	const form = new FormData();
	for (const [name, value] of Object.entries({
		title: "Show",
		date: "2024-02-29",
		tags: '["House"]',
		...changes,
	}))
		form.set(name, value);
	form.set("mp3", new File([bytes], filename));
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
		expect(response.json()).toEqual({ success: false });
		expect(await temporaryUploads()).toEqual(before);
		return response.statusCode;
	} finally {
		await app.close();
	}
};

test("streams valid audio despite the smaller global file limit, then cleans up", async () => {
	expect(await send()).toBe(501);
});

test("rejects an ID3 metadata header without audio", async () => {
	expect(
		await send({}, new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0])),
	).toBe(400);
});

test("rejects malformed metadata and cleans up audio", async () => {
	for (const changes of [
		{ title: " " },
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
	app.post("/upload", uploadMixcloudHandler);
	try {
		const result = await app.inject({
			method: "POST",
			url: "/upload",
			payload: {},
		});
		expect(result.statusCode).toBe(400);
	} finally {
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
