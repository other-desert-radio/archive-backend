import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	readLocalPublicationFiles,
	snapshotLocalPublicationFiles,
} from "../../src/publication/local-preview.js";

let directory: string;
let checkout: string;
beforeEach(async () => {
	directory = await mkdtemp(path.join(tmpdir(), "publication-local-baseline-"));
	checkout = path.join(directory, "checkout");
	await mkdir(checkout);
});
afterEach(async () => {
	await rm(directory, { recursive: true, force: true });
});
async function put(file: string, contents: string | Buffer) {
	const target = path.join(checkout, file);
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, contents);
}

test("missing generated files are a valid empty baseline", async () => {
	const empty = await snapshotLocalPublicationFiles(checkout);
	expect(empty).toMatch(/^[a-f0-9]{64}$/);
	await put("notes.txt", "local work");
	await put("src/res/mixcloud.json", "unrelated");
	expect(await snapshotLocalPublicationFiles(checkout)).toBe(empty);
});

test("local baseline reads exact managed bytes and excludes unrelated files", async () => {
	await put("src/res/tags.json", '[{"id":1}]\n');
	await put("src/res/djs/1.json", '{"id":1}\n');
	const bytes = Buffer.from([0, 1, 255, 42]);
	await put("public/assets/djs/1_small.webp", bytes);
	await put("src/res/mixcloud.json", "unrelated resource");
	await put("public/assets/logo.svg", "unrelated asset");
	await put("notes.txt", "unrelated text");
	const { files, fingerprint } = await readLocalPublicationFiles(checkout);
	expect(files.get("src/res/tags.json")?.toString("utf8")).toBe('[{"id":1}]\n');
	expect(files.get("src/res/djs/1.json")?.toString("utf8")).toBe('{"id":1}\n');
	expect(files.get("public/assets/djs/1_small.webp")).toEqual(bytes);
	expect([...files.keys()].sort()).toEqual([
		"public/assets/djs/1_small.webp",
		"src/res/djs/1.json",
		"src/res/tags.json",
	]);
	expect(await snapshotLocalPublicationFiles(checkout)).toBe(fingerprint);
});

test("fingerprints detect additions, byte replacements, renames, and deletions", async () => {
	const empty = await snapshotLocalPublicationFiles(checkout);
	await put("src/res/tags.json", "[]");
	const added = await snapshotLocalPublicationFiles(checkout);
	expect(added).not.toBe(empty);
	await put("src/res/tags.json", "{} ");
	const replaced = await snapshotLocalPublicationFiles(checkout);
	expect(replaced).not.toBe(added);
	await rm(path.join(checkout, "src/res/tags.json"));
	await put("src/res/shows.json", "{} ");
	const renamed = await snapshotLocalPublicationFiles(checkout);
	expect(renamed).not.toBe(replaced);
	await rm(path.join(checkout, "src/res/shows.json"));
	expect(await snapshotLocalPublicationFiles(checkout)).toBe(empty);
});

test("managed directory and nested file symlinks are rejected", async () => {
	const outside = path.join(directory, "outside");
	await mkdir(outside);
	await mkdir(path.join(checkout, "src/res"), { recursive: true });
	await symlink(outside, path.join(checkout, "src/res/djs"));
	await expect(snapshotLocalPublicationFiles(checkout)).rejects.toThrow(
		"symlinks",
	);
	await rm(path.join(checkout, "src/res/djs"));
	await mkdir(path.join(checkout, "src/res/djs/nested"), { recursive: true });
	await writeFile(path.join(outside, "data.json"), "private data");
	await symlink(
		path.join(outside, "data.json"),
		path.join(checkout, "src/res/djs/nested/1.json"),
	);
	await expect(snapshotLocalPublicationFiles(checkout)).rejects.toThrow(
		"symlinks",
	);
});

test("manifest bytes participate in the baseline and manifest symlinks are rejected", async () => {
	const empty = await snapshotLocalPublicationFiles(checkout);
	await put("src/res/data_versions.json", "{}");
	const first = await snapshotLocalPublicationFiles(checkout);
	expect(first).not.toBe(empty);
	await put("src/res/data_versions.json", '{"shows":{"id":2}}');
	expect(await snapshotLocalPublicationFiles(checkout)).not.toBe(first);
	await rm(path.join(checkout, "src/res/data_versions.json"));
	const outside = path.join(directory, "outside.json");
	await writeFile(outside, "{}");
	await symlink(outside, path.join(checkout, "src/res/data_versions.json"));
	await expect(snapshotLocalPublicationFiles(checkout)).rejects.toThrow(
		"symlinks",
	);
});
