import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	buildArchiveDocuments,
	writeArchiveDocuments,
} from "../../src/db/export-archive.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) =>
			rm(directory, {
				recursive: true,
				force: true,
			}),
		),
	);
});

describe("archive export documents", () => {
	test("builds public DJ documents, derived tag IDs, and image assets", () => {
		const documents = buildArchiveDocuments({
			djs: [
				{
					id: 1,
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
					title: "DJ One",
					bio: "<p>Bio</p><script>bad()</script>",
					image: Buffer.from("portrait"),
					image_filename: "portrait.png",
					socials: "<strong>@dj-one</strong><iframe>bad</iframe>",
					showTitle: "Late Night",
					showDescription: "A weekly program.",
				},
				{
					id: 2,
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
					title: "DJ Two",
					bio: "Bio",
					image: null,
					image_filename: null,
					socials: null,
					showTitle: null,
					showDescription: null,
				},
			] as never,
			shows: [
				{
					id: 10,
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
					title: "Newer Show",
					date: new Date("2026-02-01T00:00:00.000Z"),
					duration: 3600,
					image: "https://example.com/show.jpg",
					url: "https://example.com/audio",
				},
			] as never,
			tags: [
				{ id: 2, title: "House", color: "#ff1100" },
				{ id: 4, title: "Ambient", color: "#2255cc" },
			],
			showDJs: [{ dj_id: 1, show_id: 10 }],
			djTags: [{ dj_id: 1, tag_id: 4 }],
			showTags: [
				{ show_id: 10, tag_id: 2 },
				{ show_id: 10, tag_id: 4 },
			],
		});

		expect(documents.djsBrief).toEqual([
			{
				id: 1,
				title: "DJ One",
				image: "assets/djs/1.png",
				tagIds: [2, 4],
			},
			{ id: 2, title: "DJ Two", tagIds: [] },
		]);
		expect(documents.djs[0]).toEqual({
			id: 1,
			title: "DJ One",
			image: "assets/djs/1.png",
			bio: "<p>Bio</p>",
			socials: "<strong>@dj-one</strong>bad",
			showTitle: "Late Night",
			showDescription: "A weekly program.",
			shows: [
				{
					id: 10,
					title: "Newer Show",
					date: new Date("2026-02-01T00:00:00.000Z"),
					duration: 3600,
					image: "https://example.com/show.jpg",
					tagIds: [2, 4],
					url: "https://example.com/audio",
				},
			],
			tagIds: [2, 4],
		});
		expect(documents.shows).toEqual([
			{
				id: 10,
				title: "Newer Show",
				date: new Date("2026-02-01T00:00:00.000Z"),
				duration: 3600,
				image: "https://example.com/show.jpg",
				djs: [
					{
						id: 1,
						title: "DJ One",
						image: "assets/djs/1.png",
					},
				],
				tagIds: [2, 4],
				url: "https://example.com/audio",
			},
		]);
		expect(documents.tags).toEqual([
			{ id: 2, title: "House", color: "#ff1100" },
			{ id: 4, title: "Ambient", color: "#2255cc" },
		]);
		expect(documents.images).toEqual([
			{ id: 1, bytes: Buffer.from("portrait"), extension: ".png" },
		]);
	});

	test("rejects unsupported stored image filenames", () => {
		expect(() =>
			buildArchiveDocuments({
				djs: [
					{
						id: 1,
						image: Buffer.from("image"),
						image_filename: "portrait.gif",
					},
				] as never,
				shows: [],
				tags: [],
				showDJs: [],
				djTags: [],
				showTags: [],
			}),
		).toThrow("DJ 1 has an unsupported image filename: portrait.gif");
	});
});

describe("archive export writer", () => {
	test("replaces managed DJ files, preserves other output, and logs each file", async () => {
		const rootDirectory = await mkdtemp(path.join(tmpdir(), "archive-export-"));
		temporaryDirectories.push(rootDirectory);
		const resourceDirectory = path.join(rootDirectory, "res");
		const assetDirectory = path.join(rootDirectory, "assets");
		await mkdir(path.join(resourceDirectory, "djs"), { recursive: true });
		await mkdir(path.join(assetDirectory, "djs"), {
			recursive: true,
		});
		await mkdir(path.join(resourceDirectory, "shows"), { recursive: true });
		await writeFile(path.join(resourceDirectory, "djs", "stale.json"), "stale");
		await writeFile(path.join(resourceDirectory, "shows.json"), "stale");
		await writeFile(path.join(assetDirectory, "djs", "stale.jpg"), "stale");
		await writeFile(
			path.join(resourceDirectory, "shows", "10.json"),
			"future show",
		);

		const logs: string[] = [];
		await writeArchiveDocuments(
			{
				djsBrief: [{ id: 1, title: "DJ One", tagIds: [] }],
				djs: [
					{
						id: 1,
						title: "DJ One",
						bio: "Bio",
						shows: [],
						tagIds: [],
					},
				],
				shows: [
					{
						id: 10,
						title: "Show One",
						date: new Date("2026-01-01T00:00:00.000Z"),
						duration: 3600,
						djs: [{ id: 1, title: "DJ One" }],
						tagIds: [],
						url: "https://example.com/audio",
					},
				],
				tags: [{ id: 2, title: "House", color: "#ff1100" }],
				images: [{ id: 1, bytes: Buffer.from("image"), extension: ".jpg" }],
			},
			resourceDirectory,
			assetDirectory,
			{ log: (message) => logs.push(message) },
		);

		expect(
			JSON.parse(
				await readFile(path.join(resourceDirectory, "djs_brief.json"), "utf8"),
			),
		).toEqual([{ id: 1, title: "DJ One", tagIds: [] }]);
		expect(
			await readFile(path.join(resourceDirectory, "djs", "1.json"), "utf8"),
		).toContain('"title": "DJ One"');
		expect(
			JSON.parse(
				await readFile(path.join(resourceDirectory, "shows.json"), "utf8"),
			),
		).toEqual([
			{
				id: 10,
				title: "Show One",
				date: "2026-01-01T00:00:00.000Z",
				duration: 3600,
				djs: [{ id: 1, title: "DJ One" }],
				tagIds: [],
				url: "https://example.com/audio",
			},
		]);
		expect(await readFile(path.join(assetDirectory, "djs", "1.jpg"))).toEqual(
			Buffer.from("image"),
		);
		expect(
			await readFile(path.join(resourceDirectory, "shows", "10.json"), "utf8"),
		).toBe("future show");
		expect(logs).toContain("├─ Refreshing managed JSON output");
		expect(logs).toContain("│  ├─ djs/1.json");
		expect(logs).toContain("│  └─ assets/djs/1.jpg");
		expect(logs).toContain("│  ├─ shows.json: 1 shows");
		expect(logs.at(-1)).toBe("└─ Complete: 1 DJs, 1 shows, 1 tags, 1 images");
	});
});
