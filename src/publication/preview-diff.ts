import { createHash } from "node:crypto";
import { isMatching, P } from "ts-pattern";
import type { ArchiveDocuments } from "../db/export-archive.js";
import type { PublicationChanges } from "./types.js";

type ArchiveRecord = { id: number; title: string; signature: string };
export type PublicationArchive = Record<
	"shows" | "djs" | "tags",
	Map<number, ArchiveRecord>
>;
type DataRecord = { id: number; title: string; [key: string]: unknown };
const identity = { id: P.number.int().positive(), title: P.string };
const emptyArchive = (): PublicationArchive => ({
	shows: new Map(),
	djs: new Map(),
	tags: new Map(),
});
const digest = (value: Buffer | string) =>
	createHash("sha256").update(value).digest("hex");

function normalize(value: unknown): unknown {
	if (value instanceof Date) return value.toJSON();
	if (Array.isArray(value))
		return value
			.map(normalize)
			.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
	if (isMatching(P.record(P.string, P.unknown), value))
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, normalize(value[key])]),
		);
	return value;
}
function recordSignature(
	record: DataRecord,
	images: Record<string, string> = {},
): string {
	const fields = { ...record };
	for (const relationship of ["shows", "djs"]) {
		if (fields[relationship] === undefined) continue;
		const values = fields[relationship];
		if (!isMatching(P.array(identity), values))
			throw new Error("Invalid archive relationship");
		fields[relationship] = values.map((value) => value.id);
	}
	return digest(JSON.stringify(normalize({ fields, images })));
}
function add(
	archive: PublicationArchive,
	resource: keyof PublicationArchive,
	record: DataRecord,
	images?: Record<string, string>,
): void {
	if (archive[resource].has(record.id))
		throw new Error("Duplicate archive record ID");
	archive[resource].set(record.id, {
		id: record.id,
		title: record.title,
		signature: recordSignature(record, images),
	});
}
function payload(value: unknown): unknown {
	if (
		isMatching(
			{
				version: P.number.int().positive(),
				updatedAt: P.string,
				data: P.unknown,
			},
			value,
		)
	)
		return value.data;
	return value;
}
function records(value: unknown): DataRecord[] {
	if (!isMatching(P.array(identity), value))
		throw new Error("Invalid archive records");
	return value;
}

/** Read only the existing generated records and referenced DJ image bytes. */
export async function readPublicationArchive(
	read: (file: string) => Promise<Buffer | undefined>,
	listDJFiles: () => Promise<string[]>,
): Promise<PublicationArchive> {
	const archive = emptyArchive();
	const json = async (file: string): Promise<unknown> => {
		const bytes = await read(file);
		return bytes === undefined ? undefined : JSON.parse(bytes.toString("utf8"));
	};
	for (const resource of ["shows", "tags"] as const) {
		const value = await json(`src/res/${resource}.json`);
		if (value !== undefined)
			for (const record of records(payload(value)))
				add(archive, resource, record);
	}
	const brief = await json("src/res/djs_brief.json");
	if (brief !== undefined) records(payload(brief));
	for (const file of (await listDJFiles()).sort()) {
		const name = file.split("/").at(-1) ?? file;
		if (!name.endsWith(".json")) continue;
		const [record] = records([payload(await json(`src/res/djs/${name}`))]);
		if (!record || name !== `${record.id}.json`)
			throw new Error("Invalid archive DJ filename");
		const images: Record<string, string> = {};
		for (const variant of ["small", "large"]) {
			if (record[`image_${variant}`] === undefined) continue;
			const bytes = await read(
				`public/assets/djs/${record.id}_${variant}.webp`,
			);
			if (!bytes) throw new Error("Missing archive DJ image");
			images[variant] = digest(bytes);
		}
		add(archive, "djs", record, images);
	}
	return archive;
}

/** Use the database export documents directly; no preview directory is needed. */
export function documentsPublicationArchive(
	documents: ArchiveDocuments,
): PublicationArchive {
	const archive = emptyArchive();
	const images = new Map<number, Record<string, string>>();
	for (const image of documents.images) {
		const variants = images.get(image.id) ?? {};
		variants[image.variant] = digest(image.bytes);
		images.set(image.id, variants);
	}
	for (const resource of ["shows", "tags", "djs"] as const)
		for (const record of documents[resource])
			add(
				archive,
				resource,
				record,
				resource === "djs" ? (images.get(record.id) ?? {}) : undefined,
			);
	return archive;
}

export function comparePublicationArchives(
	before: PublicationArchive,
	after: PublicationArchive,
): PublicationChanges {
	const changes: PublicationChanges = {
		shows: { added: [], changed: [], removed: [] },
		djs: { added: [], changed: [], removed: [] },
		tags: { added: [], changed: [], removed: [] },
	};
	for (const resource of ["shows", "djs", "tags"] as const) {
		for (const record of after[resource].values()) {
			const old = before[resource].get(record.id);
			if (!old) changes[resource].added.push(record.title);
			else if (record.signature !== old.signature)
				changes[resource].changed.push(record.title);
		}
		for (const record of before[resource].values())
			if (!after[resource].has(record.id))
				changes[resource].removed.push(record.title);
		for (const kind of ["added", "changed", "removed"] as const)
			changes[resource][kind].sort((a, b) => a.localeCompare(b));
	}
	return changes;
}
