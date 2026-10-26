import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import {
	archiveExportDirectories,
	buildArchiveDocuments,
	exportArchive,
	writeArchiveDocuments,
} from "../../src/db/export-archive.js";
import { up as createPublicationState } from "../../src/db/migrations/0029_add_archive_publication_state.js";
import type { Database } from "../../src/db/types.js";
import { readPublicationSnapshot } from "../../src/publication/index.js";

const temporaryDirectories: string[] = [];

const exportDatabaseUrl = process.env.ARCHIVE_EXPORT_TEST_DATABASE_URL;

const createArchiveFixture = async (pool: Pool): Promise<void> => {
	// Minimal current archive schema: fixtures exercise export reads, not historical schema migrations.
	await pool.query(`
	CREATE TABLE djs (id integer, title text, bio text, image_small bytea, image_large bytea, socials text, "showTitle" text, "showDescription" text);
	CREATE TABLE shows (id integer, title text, date timestamptz, duration integer, mixcloud_image_small text, mixcloud_image_large text, url text, image_small bytea, image_large bytea);
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
};

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
			await createArchiveFixture(pool);
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

test.skipIf(!exportDatabaseUrl)(
	"archive and publication snapshots remain consistent across committed writes and recover from read failures",
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
			await createArchiveFixture(pool);
			// Interleave committed writes after a real SELECT completes, without sleeps.
			const database = new Kysely<Database>({
				dialect: new PostgresDialect({ pool }),
			});
			await pool.query("DROP TABLE archive_publication_state");
			await database.transaction().execute(createPublicationState);
			const interleave = (column: string, write: () => Promise<void>) => {
				let changed = false;
				return database.withPlugin({
					transformQuery: ({ node }) => node,
					transformResult: async ({ result }) => {
						if (!changed && result.rows.some((row) => column in row)) {
							changed = true;
							await write();
						}
						return result;
					},
				});
			};
			const exportDatabase = interleave("title", async () => {
				await database.transaction().execute(async (transaction) => {
					await transaction
						.updateTable("djs")
						.set({ title: "Changed DJ" })
						.execute();
					await transaction
						.updateTable("shows")
						.set({ title: "Changed Show" })
						.execute();
					await transaction
						.updateTable("tags")
						.set({ title: "Changed Tag" })
						.execute();
					await transaction
						.insertInto("dj_tags")
						.values({ dj_id: 1, tag_id: 2 })
						.execute();
				});
			});
			const resources = path.join(checkout, "src/res");
			await exportArchive(
				exportDatabase,
				resources,
				path.join(checkout, "public/assets"),
				{ log: () => {} },
			);
			const originalDJ = JSON.parse(
				await readFile(path.join(resources, "djs/1.json"), "utf8"),
			);
			expect(originalDJ.title).toBe("CLI DJ");
			expect(originalDJ.tagIds).toEqual([1]);
			expect(originalDJ.shows[0].title).toBe("CLI Show");
			expect(
				JSON.parse(await readFile(path.join(resources, "tags.json"), "utf8"))[0]
					.title,
			).toBe("CLI Tag");
			// The next read sees the committed changes, not a retained snapshot.
			const changed = await readPublicationSnapshot(database);
			expect(changed.revision).toBe("5");
			expect(changed.documents.djs[0]?.title).toBe("Changed DJ");
			expect(changed.documents.djs[0]?.tagIds).toEqual([1, 2]);
			const publicationDatabase = interleave("revision", async () => {
				await database.transaction().execute(async (transaction) => {
					await transaction
						.updateTable("djs")
						.set({ title: "Newest DJ", image_large: Buffer.from("new-image") })
						.execute();
					await transaction
						.updateTable("shows")
						.set({ title: "Newest Show" })
						.execute();
					await transaction
						.updateTable("tags")
						.set({ title: "Newest Tag" })
						.execute();
					await transaction.deleteFrom("dj_tags").execute();
				});
			});
			const captured = await readPublicationSnapshot(publicationDatabase);
			expect(captured.revision).toBe("5");
			expect(captured.documents.djs[0]?.title).toBe("Changed DJ");
			expect(captured.documents.shows[0]?.title).toBe("Changed Show");
			expect(captured.documents.tags[0]?.title).toBe("Changed Tag");
			expect(captured.documents.djs[0]?.tagIds).toEqual([1, 2]);
			expect(
				captured.documents.images.find((image) => image.variant === "large")
					?.bytes,
			).toEqual(Buffer.from("large"));
			const newest = await readPublicationSnapshot(database);
			expect(newest.revision).toBe("9");
			expect(newest.documents.djs[0]?.title).toBe("Newest DJ");
			expect(newest.documents.djs[0]?.tagIds).toEqual([1]);
			expect(
				(
					await pool.query(
						"SELECT published_revision FROM archive_publication_state",
					)
				).rows,
			).toEqual([{ published_revision: "0" }]);
			// Failed reads must not replace existing output or poison the next transaction.
			await pool.query("ALTER TABLE show_tags RENAME TO unavailable_show_tags");
			await expect(
				exportArchive(
					database,
					resources,
					path.join(checkout, "public/assets"),
					{ log: () => {} },
				),
			).rejects.toThrow();
			expect(
				JSON.parse(await readFile(path.join(resources, "djs/1.json"), "utf8")),
			).toEqual(originalDJ);
			await pool.query("ALTER TABLE unavailable_show_tags RENAME TO show_tags");
			await pool.query("DELETE FROM archive_publication_state");
			await expect(readPublicationSnapshot(database)).rejects.toThrow();
			await database.transaction().execute(async (transaction) => {
				await transaction
					.insertInto("archive_publication_state")
					.defaultValues()
					.execute();
			});
			expect((await readPublicationSnapshot(database)).revision).toBe("1");
		} finally {
			await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
			await pool.end();
		}
	},
);

test("export destinations require a checkout and honor its configuration", () => {
	expect(() =>
		archiveExportDirectories({
			environment: {},
			repositoryRoot: "/work/backend",
		}),
	).toThrow("ARCHIVE_CHECKOUT_PATH");

	expect(
		archiveExportDirectories({
			environment: { ARCHIVE_CHECKOUT_PATH: "../archive-site" },
			repositoryRoot: "/work/backend",
		}),
	).toEqual({
		resourceDirectory: "/work/archive-site/src/res",
		assetDirectory: "/work/archive-site/public/assets",
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
					mixcloud_image_small: "https://example.com/show-small.jpg",
					mixcloud_image_large: "https://example.com/show.jpg",
					image_small: Buffer.from("reserved-small-webp"),
					image_large: Buffer.from("reserved-large-webp"),
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
