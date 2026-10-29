import { expect, test } from "bun:test";
import type { ArchiveDocuments } from "../../src/db/export-archive.js";
import {
	comparePublicationArchives,
	documentsPublicationArchive,
	readPublicationArchive,
} from "../../src/publication/preview-diff.js";

const documents = (): ArchiveDocuments => ({
	djsBrief: [],
	djs: [],
	shows: [],
	tags: [],
	images: [],
});
const tag = (id: number, title: string) => ({ id, title, color: "#ffffff" });
const dj = (id: number, title: string) => ({
	id,
	title,
	bio: "Bio",
	tagIds: [],
	shows: [],
});
const show = (id: number, title: string) => ({
	id,
	title,
	date: new Date("2026-01-01T00:00:00Z"),
	duration: 60,
	url: "https://example.com/show",
	image_small: "https://example.com/small",
	image_large: "https://example.com/large",
	tagIds: [],
});
const read = async (
	files: Record<string, unknown>,
	images: Record<string, Buffer> = {},
) =>
	readPublicationArchive(
		async (file) =>
			images[file] ??
			(files[file] === undefined
				? undefined
				: Buffer.from(JSON.stringify(files[file]))),
		async () =>
			Object.keys(files).filter((file) => file.startsWith("src/res/djs/")),
	);

test("compares additions changes removals by ID and returns sorted names", () => {
	const before = documents();
	before.tags = [tag(1, "Removed"), tag(2, "Old title")];
	const after = documents();
	after.tags = [tag(4, "Zulu"), tag(3, "Alpha"), tag(2, "New title")];
	expect(
		comparePublicationArchives(
			documentsPublicationArchive(before),
			documentsPublicationArchive(after),
		),
	).toEqual({
		shows: { added: [], changed: [], removed: [] },
		djs: { added: [], changed: [], removed: [] },
		tags: {
			added: ["Alpha", "Zulu"],
			changed: ["New title"],
			removed: ["Removed"],
		},
	});
});

test("reading serialized exports matches database documents, including dates and images", async () => {
	const data = documents();
	data.shows = [{ ...show(1, "Show"), djs: [{ id: 1, title: "DJ" }] }];
	data.tags = [tag(1, "Tag")];
	data.djs = [
		{
			...dj(1, "DJ"),
			image_small: "assets/djs/1_small.webp",
			shows: [show(1, "Show")],
		},
	];
	data.images = [{ id: 1, variant: "small", bytes: Buffer.from("image") }];
	const baseline = await read(
		{
			"src/res/shows.json": data.shows,
			"src/res/tags.json": data.tags,
			"src/res/djs/1.json": data.djs[0],
		},
		{ "public/assets/djs/1_small.webp": Buffer.from("image") },
	);
	expect(
		comparePublicationArchives(baseline, documentsPublicationArchive(data)).djs
			.changed,
	).toEqual([]);
	expect(
		comparePublicationArchives(baseline, documentsPublicationArchive(data))
			.shows.changed,
	).toEqual([]);
});

test("array order and duplicated embedded details do not count as changes", () => {
	const before = documents();
	const after = documents();
	before.djs = [
		{
			...dj(1, "DJ"),
			tagIds: [2, 1],
			shows: [show(1, "Old"), show(2, "Second")],
		},
	];
	after.djs = [
		{
			...dj(1, "DJ"),
			tagIds: [1, 2],
			shows: [show(2, "Second"), show(1, "New")],
		},
	];
	before.shows = [
		{
			...show(1, "Show"),
			djs: [
				{ id: 1, title: "Old DJ" },
				{ id: 2, title: "Second" },
			],
		},
	];
	after.shows = [
		{
			...show(1, "Show"),
			djs: [
				{ id: 2, title: "Second" },
				{ id: 1, title: "Renamed DJ" },
			],
		},
	];
	const result = comparePublicationArchives(
		documentsPublicationArchive(before),
		documentsPublicationArchive(after),
	);
	expect(result.djs.changed).toEqual([]);
	expect(result.shows.changed).toEqual([]);
	after.djs[0] = { ...dj(1, "DJ"), tagIds: [1, 2], shows: [show(2, "Second")] };
	expect(
		comparePublicationArchives(
			documentsPublicationArchive(before),
			documentsPublicationArchive(after),
		).djs.changed,
	).toEqual(["DJ"]);
});

test("replacing image bytes at a stable URL changes its DJ", () => {
	const before = documents();
	before.djs = [{ ...dj(1, "DJ"), image_small: "assets/djs/1_small.webp" }];
	before.images = [{ id: 1, variant: "small", bytes: Buffer.from("old") }];
	const after = {
		...before,
		images: [{ id: 1, variant: "small" as const, bytes: Buffer.from("new") }],
	};
	expect(
		comparePublicationArchives(
			documentsPublicationArchive(before),
			documentsPublicationArchive(after),
		).djs.changed,
	).toEqual(["DJ"]);
});

test("missing baseline is valid; malformed JSON, identities and duplicate IDs fail", async () => {
	const empty = await read({});
	expect(
		comparePublicationArchives(empty, documentsPublicationArchive(documents()))
			.tags.added,
	).toEqual([]);
	await expect(
		readPublicationArchive(
			async () => Buffer.from("{"),
			async () => [],
		),
	).rejects.toThrow();
	await expect(
		read({ "src/res/tags.json": [{ id: "1", title: "Wrong" }] }),
	).rejects.toThrow("Invalid archive records");
	await expect(
		read({ "src/res/tags.json": [tag(1, "One"), tag(1, "Two")] }),
	).rejects.toThrow("Duplicate");
	await expect(
		read({
			"src/res/djs/1.json": {
				...dj(1, "DJ"),
				image_small: "assets/djs/1_small.webp",
			},
		}),
	).rejects.toThrow("Missing archive DJ image");
});

test("legacy and versioned documents compare equally despite metadata changes", async () => {
	const data = {
		"src/res/shows.json": [{ ...show(1, "Show"), djs: [] }],
		"src/res/djs_brief.json": [],
		"src/res/djs/1.json": dj(1, "DJ"),
		"src/res/tags.json": [tag(1, "Tag")],
	};
	const legacy = await read(data);
	for (const version of [1, 2]) {
		const wrapped = Object.fromEntries(
			Object.entries(data).map(([file, value]) => [
				file,
				{
					version,
					updatedAt: `2026-01-0${version}T00:00:00.000Z`,
					data: value,
				},
			]),
		);
		const changes = comparePublicationArchives(legacy, await read(wrapped));
		for (const resource of Object.values(changes))
			expect(resource).toEqual({ added: [], changed: [], removed: [] });
	}
});
