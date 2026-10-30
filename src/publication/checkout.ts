import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { isMatching } from "ts-pattern";
import { readArchiveCheckoutPath } from "./config.js";

const entryAt = async (file: string) => {
	try {
		return await lstat(file);
	} catch (error) {
		if (isMatching({ code: "ENOENT" }, error)) return undefined;
		throw new Error("Unable to inspect publication output paths");
	}
};

/**
 * Validate an existing destination and exporter-owned output paths using only
 * filesystem reads. Resolve paths internally to check filesystem boundaries.
 * Reject inaccessible paths, overlap with the backend, and unsafe output entries.
 * Does not inspect Git state or require a Git repository.
 */
export const validatePublicationDestination = async ({
	checkoutPath,
	repositoryRoot,
}: {
	checkoutPath: string;
	repositoryRoot: string;
}): Promise<void> => {
	if (!path.isAbsolute(checkoutPath))
		throw new Error("Publication checkout path must be absolute");
	if (!path.isAbsolute(repositoryRoot))
		throw new Error("Backend repository root must be absolute");
	let checkout: string;
	let backend: string;
	try {
		checkout = await realpath(checkoutPath);
		backend = await realpath(repositoryRoot);
	} catch {
		throw new Error(
			"Publication checkout and backend must already exist and be accessible",
		);
	}
	readArchiveCheckoutPath({
		environment: { ARCHIVE_CHECKOUT_PATH: checkout },
		repositoryRoot: backend,
	});
	if (!(await entryAt(checkout))?.isDirectory())
		throw new Error("Publication checkout must be a directory");
	for (const directory of [
		"src",
		"src/res",
		"src/res/djs",
		"public",
		"public/assets",
		"public/assets/djs",
	]) {
		const entry = await entryAt(path.join(checkout, directory));
		if (entry !== undefined && (!entry.isDirectory() || entry.isSymbolicLink()))
			throw new Error(
				"Publication output directories must be real directories without symlinks",
			);
	}
	for (const file of [
		"src/res/djs_brief.json",
		"src/res/shows.json",
		"src/res/tags.json",
		"src/res/data_versions.json",
	]) {
		const entry = await entryAt(path.join(checkout, file));
		if (entry !== undefined && (!entry.isFile() || entry.isSymbolicLink()))
			throw new Error(
				"Publication JSON destinations must be regular files without symlinks",
			);
	}
};
