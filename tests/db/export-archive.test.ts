import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
	archiveExportDirectories,
	buildArchiveDocuments,
	writeArchiveDocuments,
} from "../../src/db/export-archive.js";

const temporaryDirectories: string[] = [];

const exportDatabaseUrl = process.env.ARCHIVE_EXPORT_TEST_DATABASE_URL;

test.skipIf(!exportDatabaseUrl)(
	"publish-locally exports from a disposable database without acknowledging revisions or requiring Git",
	async () => {
		const schema = `export_${crypto.randomUUID().replaceAll("-", "")}`;
		const pool = new Pool({
			connectionString: exportDatabaseUrl,
			options: `-c search_path=${schema}`,
		});
		const checkout = await mkdtemp(path.join(tmpdir(), "publish-locally-"));
		temporaryDirectories.push(checkout);
		try {
			await pool.query(`CREATE SCHEMA ${schema}`);
			// Minimal current archive schema: this test exercises the CLI, not migrations.
			await pool.query(`
			CREATE TABLE djs (id integer, title text, bio text, image_small bytea, image_large bytea, socials text, "showTitle" text, "showDescription" text);
			CREATE TABLE shows (id integer, title text, date timestamptz, duration integer, image_small text, image_large text, url text);
			CREATE TABLE tags (id integer, title text, color text, mixcloud_key text, mixcloud_url text);
			CREATE TABLE show_djs (dj_id integer, show_id integer);
			CREATE TABLE dj_tags (dj_id integer, tag_id integer);
			CREATE TABLE show_tags (show_id integer, tag_id integer);
			CREATE TABLE archive_publication_state (id integer, revision bigint, published_revision bigint);
			INSERT INTO archive_publication_state VALUES (1, 7, 2);
			INSERT INTO djs VALUES (1, 'CLI DJ', '<p>Bio</p>', decode('736d616c6c', 'hex'), decode('6c61726765', 'hex'), NULL, NULL, NULL);
			INSERT INTO shows VALUES (1, 'CLI Show', '2026-01-01', 60, 'https://example.test/small', 'https://example.test/large', 'https://example.test/audio');
			INSERT INTO tags VALUES (1, 'CLI Tag', '#cccccc', NULL, NULL);
			INSERT INTO show_djs VALUES (1, 1);
			INSERT INTO show_tags VALUES (1, 1);
		`);
			await mkdir(path.join(checkout, "public/assets/djs"), {
				recursive: true,
			});
			await writeFile(
				path.join(checkout, "public/assets/keep.txt"),
				"preserved",
			);
			await writeFile(
				path.join(checkout, "public/assets/djs/stale.webp"),
				"stale",
			);
			const connection = new URL(exportDatabaseUrl ?? "");
			connection.searchParams.set("options", `-c search_path=${schema}`);
			const process = Bun.spawn(["bun", "run", "publish-locally"], {
				cwd: fileURLToPath(new URL("../../", import.meta.url)),
				env: {
					...Bun.env,
					DATABASE_URL: connection.toString(),
					ARCHIVE_CHECKOUT_PATH: checkout,
				},
				stdout: "pipe",
				stderr: "pipe",
			});
			const [exitCode, stdout, stderr] = await Promise.all([
				process.exited,
				new Response(process.stdout).text(),
				new Response(process.stderr).text(),
			]);
			expect({ exitCode, stderr: stderr.replace(/^\$.*\n/, "") }).toEqual({
				exitCode: 0,
				stderr: "",
			});
			expect(stdout).toContain("Complete: 1 DJs, 1 shows, 1 tags, 2 images");
			expect(
				JSON.parse(
					await readFile(path.join(checkout, "src/res/djs_brief.json"), "utf8"),
				),
			).toEqual([
				{
					id: 1,
					title: "CLI DJ",
					image_small: "assets/djs/1_small.webp",
					image_large: "assets/djs/1_large.webp",
					tagIds: [1],
				},
			]);
			expect(
				await readFile(
					path.join(checkout, "public/assets/djs/1_large.webp"),
					"utf8",
				),
			).toBe("large");
			expect(
				await readFile(path.join(checkout, "public/assets/keep.txt"), "utf8"),
			).toBe("preserved");
			expect(
				await Bun.file(
					path.join(checkout, "public/assets/djs/stale.webp"),
				).exists(),
			).toBe(false);
			expect(
				(await pool.query("SELECT * FROM archive_publication_state")).rows,
			).toEqual([{ id: 1, revision: "7", published_revision: "2" }]);
		} finally {
			await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
			await pool.end();
		}
	},
);

test("export destinations retain the sibling default and honor checkout configuration", () => {
	expect(
		archiveExportDirectories({
			environment: {},
			repositoryRoot: "/work/backend",
		}),
	).toEqual({
		resourceDirectory: "/work/archive-site/src/res",
		assetDirectory: "/work/archive-site/public/assets",
	});
	expect(
		archiveExportDirectories({
			environment: { ARCHIVE_CHECKOUT_PATH: "../clean-archive-site" },
			repositoryRoot: "/work/backend",
		}),
	).toEqual({
		resourceDirectory: "/work/clean-archive-site/src/res",
		assetDirectory: "/work/clean-archive-site/public/assets",
	});
	expect(
		archiveExportDirectories({
			environment: {
				ARCHIVE_CHECKOUT_PATH: "/archive-site",
				ARCHIVE_PUBLISH_ENABLED: "invalid",
				ARCHIVE_PUBLISH_BRANCH: "invalid branch",
			},
			repositoryRoot: "/work/backend",
		}),
	).toEqual({
		resourceDirectory: "/archive-site/src/res",
		assetDirectory: "/archive-site/public/assets",
	});
	expect(() =>
		archiveExportDirectories({
			environment: { ARCHIVE_CHECKOUT_PATH: "." },
			repositoryRoot: "/work/backend",
		}),
	).toThrow("ARCHIVE_CHECKOUT_PATH");
});

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
					image_small: Buffer.from("portrait-small"),
					image_large: Buffer.from("portrait-large"),
					socials: "<strong>@dj-one</strong><iframe>bad</iframe>",
					showTitle: "Late Night",
					showDescription: "A weekly program.",
				},
				{
					id: 2,
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
					title: "DJ Two",
					bio: "Bio",
					image_small: null,
					image_large: null,
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
					image_small: "https://example.com/show-small.jpg",
					image_large: "https://example.com/show.jpg",
					url: "https://example.com/audio",
				},
			] as never,
			tags: [
				{
					id: 2,
					title: "House",
					color: "#ff1100",
					mixcloud_key: "/genres/house/",
					mixcloud_url: "https://www.mixcloud.com/genres/house/",
				},
				{
					id: 4,
					title: "Ambient",
					color: "#2255cc",
					mixcloud_key: null,
					mixcloud_url: null,
				},
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
				image_small: "assets/djs/1_small.webp",
				image_large: "assets/djs/1_large.webp",
				tagIds: [2, 4],
			},
			{ id: 2, title: "DJ Two", tagIds: [] },
		]);
		expect(documents.djs[0]).toEqual({
			id: 1,
			title: "DJ One",
			image_small: "assets/djs/1_small.webp",
			image_large: "assets/djs/1_large.webp",
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
					image_small: "https://example.com/show-small.jpg",
					image_large: "https://example.com/show.jpg",
					tagIds: [2, 4],
					url: "https://example.com/audio",
				},
			],
			tagIds: [2, 4],
		});
		expect(documents.djs[1]).not.toHaveProperty("image_small");
		expect(documents.djs[1]).not.toHaveProperty("image_large");
		expect(documents.shows).toEqual([
			{
				id: 10,
				title: "Newer Show",
				date: new Date("2026-02-01T00:00:00.000Z"),
				duration: 3600,
				image_small: "https://example.com/show-small.jpg",
				image_large: "https://example.com/show.jpg",
				djs: [
					{
						id: 1,
						title: "DJ One",
						image_small: "assets/djs/1_small.webp",
						image_large: "assets/djs/1_large.webp",
					},
				],
				tagIds: [2, 4],
				url: "https://example.com/audio",
			},
		]);
		expect(documents.tags).toEqual([
			{
				id: 2,
				title: "House",
				color: "#ff1100",
				mixcloud_key: "/genres/house/",
				mixcloud_url: "https://www.mixcloud.com/genres/house/",
			},
			{ id: 4, title: "Ambient", color: "#2255cc" },
		]);
		expect(documents.images).toEqual([
			{ id: 1, bytes: Buffer.from("portrait-small"), variant: "small" },
			{ id: 1, bytes: Buffer.from("portrait-large"), variant: "large" },
		]);
	});

	test("rejects incomplete WebP image pairs", () => {
		expect(() =>
			buildArchiveDocuments({
				djs: [
					{
						id: 1,
						image_small: Buffer.from("image"),
						image_large: null,
					},
				] as never,
				shows: [],
				tags: [],
				showDJs: [],
				djTags: [],
				showTags: [],
			}),
		).toThrow("DJ 1 has an incomplete WebP image pair");
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
		await writeFile(path.join(assetDirectory, "djs", "stale.webp"), "stale");
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
						image_small: "https://example.com/small.jpg",
						image_large: "https://example.com/large.jpg",
						date: new Date("2026-01-01T00:00:00.000Z"),
						duration: 3600,
						djs: [{ id: 1, title: "DJ One" }],
						tagIds: [],
						url: "https://example.com/audio",
					},
				],
				tags: [{ id: 2, title: "House", color: "#ff1100" }],
				images: [
					{ id: 1, bytes: Buffer.from("small"), variant: "small" },
					{ id: 1, bytes: Buffer.from("large"), variant: "large" },
				],
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
				image_small: "https://example.com/small.jpg",
				image_large: "https://example.com/large.jpg",
				date: "2026-01-01T00:00:00.000Z",
				duration: 3600,
				djs: [{ id: 1, title: "DJ One" }],
				tagIds: [],
				url: "https://example.com/audio",
			},
		]);
		expect(
			await readFile(path.join(assetDirectory, "djs", "1_small.webp")),
		).toEqual(Buffer.from("small"));
		expect(
			await readFile(path.join(assetDirectory, "djs", "1_large.webp")),
		).toEqual(Buffer.from("large"));
		expect(
			await readFile(path.join(resourceDirectory, "shows", "10.json"), "utf8"),
		).toBe("future show");
		expect(logs).toContain("├─ Refreshing managed JSON output");
		expect(logs).toContain("│  ├─ djs/1.json");
		expect(logs).toContain("│  └─ assets/djs/1_large.webp");
		expect(logs).toContain("│  ├─ shows.json: 1 shows");
		expect(logs.at(-1)).toBe("└─ Complete: 1 DJs, 1 shows, 1 tags, 2 images");
	});
});
