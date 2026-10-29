import { afterEach, expect, test } from "bun:test";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validatePublicationDestination } from "../../src/publication/index.js";

const directories: string[] = [];

afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

const fixture = async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "publication-checkout-"));
	directories.push(directory);
	const checkoutPath = path.join(directory, "site");
	const repositoryRoot = path.join(directory, "backend");
	await mkdir(checkoutPath);
	await mkdir(repositoryRoot);
	return { directory, checkoutPath, repositoryRoot };
};

test("destination validation needs no Git repository and creates no output", async () => {
	const target = await fixture();
	await expect(validatePublicationDestination(target)).resolves.toBeUndefined();
	expect(await readdir(target.checkoutPath)).toEqual([]);
});

test("destination validation preserves generated and unrelated files", async () => {
	const target = await fixture();
	await mkdir(path.join(target.checkoutPath, "src/res/djs"), {
		recursive: true,
	});
	await mkdir(path.join(target.checkoutPath, "public/assets/djs"), {
		recursive: true,
	});
	const files = ["src/res/shows.json", "src/res/djs/1.json", "notes.txt"];
	for (const file of files)
		await writeFile(path.join(target.checkoutPath, file), "existing content");
	await validatePublicationDestination(target);
	for (const file of files)
		expect(await readFile(path.join(target.checkoutPath, file), "utf8")).toBe(
			"existing content",
		);
});

test("destination validation rejects relative, missing, and non-directory destinations", async () => {
	const target = await fixture();
	await expect(
		validatePublicationDestination({ ...target, checkoutPath: "relative" }),
	).rejects.toThrow("checkout path must be absolute");
	await expect(
		validatePublicationDestination({ ...target, repositoryRoot: "relative" }),
	).rejects.toThrow("root must be absolute");
	await expect(
		validatePublicationDestination({
			...target,
			checkoutPath: path.join(target.directory, "missing"),
		}),
	).rejects.toThrow("already exist and be accessible");
	const file = path.join(target.directory, "file");
	await writeFile(file, "keep");
	await expect(
		validatePublicationDestination({ ...target, checkoutPath: file }),
	).rejects.toThrow("must be a directory");
});

test("destination validation rejects overlap after resolving symlinks", async () => {
	const target = await fixture();
	const nested = path.join(target.repositoryRoot, "nested");
	await mkdir(nested);
	const alias = path.join(target.directory, "backend-alias");
	await symlink(target.repositoryRoot, alias);
	for (const checkoutPath of [
		target.repositoryRoot,
		target.directory,
		nested,
		alias,
	]) {
		await expect(
			validatePublicationDestination({ ...target, checkoutPath }),
		).rejects.toThrow("separate from the backend");
	}
	// Resolving a backend alias must not conceal a destination inside it.
	await expect(
		validatePublicationDestination({
			checkoutPath: nested,
			repositoryRoot: alias,
		}),
	).rejects.toThrow("separate from the backend");
});

for (const directory of [
	"src",
	"src/res",
	"src/res/djs",
	"public",
	"public/assets",
	"public/assets/djs",
]) {
	test(`destination validation rejects a symlink or file at ${directory}`, async () => {
		const target = await fixture();
		const output = path.join(target.checkoutPath, directory);
		await mkdir(path.dirname(output), { recursive: true });
		const outside = path.join(target.directory, "outside");
		await mkdir(outside);
		await writeFile(path.join(outside, "sentinel"), "keep");
		await symlink(outside, output);
		await expect(validatePublicationDestination(target)).rejects.toThrow(
			"directories without symlinks",
		);
		expect(await readFile(path.join(outside, "sentinel"), "utf8")).toBe("keep");
		await rm(output);
		await writeFile(output, "keep");
		await expect(validatePublicationDestination(target)).rejects.toThrow(
			"directories without symlinks",
		);
		expect(await readFile(output, "utf8")).toBe("keep");
	});
}

for (const file of [
	"djs_brief.json",
	"shows.json",
	"tags.json",
	"data_versions.json",
]) {
	test(`destination validation rejects symlinks and directories at ${file}`, async () => {
		const target = await fixture();
		await mkdir(path.join(target.checkoutPath, "src/res"), { recursive: true });
		const output = path.join(target.checkoutPath, "src/res", file);
		const outside = path.join(target.directory, "outside.json");
		await writeFile(outside, "keep");
		await symlink(outside, output);
		await expect(validatePublicationDestination(target)).rejects.toThrow(
			"regular files without symlinks",
		);
		expect(await readFile(outside, "utf8")).toBe("keep");
		await rm(output);
		await mkdir(output);
		await expect(validatePublicationDestination(target)).rejects.toThrow(
			"regular files without symlinks",
		);
	});
}
