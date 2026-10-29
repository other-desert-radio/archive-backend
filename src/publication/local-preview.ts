import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { isMatching } from "ts-pattern";

const managedPaths = [
	"src/res/djs",
	"src/res/djs_brief.json",
	"src/res/shows.json",
	"src/res/tags.json",
	"src/res/data_versions.json",
	"public/assets/djs",
];

/** Read only exporter-owned local files, rejecting symlinks and oversized archives. */
export const readLocalPublicationFiles = async (checkout: string) => {
	const files = new Map<string, Buffer>();
	const hash = createHash("sha256");
	let totalBytes = 0;
	const visit = async (relative: string): Promise<void> => {
		const source = path.join(checkout, relative);
		let entry: Stats;
		try {
			entry = await lstat(source);
		} catch (error) {
			if (isMatching({ code: "ENOENT" }, error)) return;
			throw error;
		}
		if (entry.isSymbolicLink())
			throw new Error("Local preview files must not contain symlinks");
		if (entry.isDirectory()) {
			for (const name of (await readdir(source)).sort())
				await visit(path.join(relative, name));
			return;
		}
		if (!entry.isFile())
			throw new Error("Local preview files must be regular files");
		if (totalBytes + entry.size > 256 * 1024 * 1024)
			throw new Error("Publication preview exceeds the 256 MB limit");
		const bytes = await readFile(source);
		totalBytes += bytes.length;
		if (totalBytes > 256 * 1024 * 1024)
			throw new Error("Publication preview exceeds the 256 MB limit");
		hash.update(`${relative.length}:${relative}:${bytes.length}:`);
		hash.update(bytes);
		files.set(relative, bytes);
	};
	for (const relative of managedPaths) await visit(relative);
	return { fingerprint: hash.digest("hex"), files };
};

export const snapshotLocalPublicationFiles = async (
	checkout: string,
): Promise<string> => (await readLocalPublicationFiles(checkout)).fingerprint;
