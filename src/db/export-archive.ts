import { promises as fs } from "node:fs";
import path from "node:path";
import type { Kysely, Selectable } from "kysely";
import { sanitizeArchiveHtml } from "../utils/sanitize-html.js";
import { db } from "./db.js";
import type {
	Database,
	DJsTable,
	DjTagsTable,
	ShowDJsTable,
	ShowsTable,
	ShowTagsTable,
	TagsTable,
} from "./types.js";

/** Directory where Astro imports archive JSON during the site build. */
export const ARCHIVE_RESOURCE_DIRECTORY =
	"/home/garrepi/dev/odr/archive-site/src/res";

/** Directory where Astro serves copied DJ image assets. */
export const ARCHIVE_ASSET_DIRECTORY =
	"/home/garrepi/dev/odr/archive-site/public/assets";

type ArchiveDJImage = {
	id: number;
	bytes: Buffer;
	extension: ".jpg" | ".png" | ".webp";
};

type ArchiveShow = {
	id: number;
	title: string;
	date: Date;
	duration: number;
	image?: string;
	tagIds: number[];
	url: string;
};

export type ArchiveDJBrief = {
	id: number;
	title: string;
	image?: string;
	tagIds: number[];
};

export type ArchiveDJDetail = ArchiveDJBrief & {
	bio: string;
	socials?: string;
	showTitle?: string;
	showDescription?: string;
	shows: ArchiveShow[];
};

export type ArchiveTag = {
	id: number;
	title: string;
	color: string;
	mixcloud_key?: string;
	mixcloud_url?: string;
};

export type ArchiveDocuments = {
	djsBrief: ArchiveDJBrief[];
	djs: ArchiveDJDetail[];
	tags: ArchiveTag[];
	images: ArchiveDJImage[];
};

export type ArchiveExportReporter = {
	log: (message: string) => void;
};

export type BuildArchiveDocumentsParams = {
	djs: Array<Selectable<DJsTable>>;
	shows: Array<Selectable<ShowsTable>>;
	tags: Array<
		Pick<
			Selectable<TagsTable>,
			"id" | "title" | "color" | "mixcloud_key" | "mixcloud_url"
		>
	>;
	showDJs: Array<Pick<Selectable<ShowDJsTable>, "dj_id" | "show_id">>;
	djTags: Array<Pick<Selectable<DjTagsTable>, "dj_id" | "tag_id">>;
	showTags: Array<Pick<Selectable<ShowTagsTable>, "show_id" | "tag_id">>;
};

const staticImageExtension = (
	filename: string,
): ArchiveDJImage["extension"] | undefined => {
	const extension = path.extname(filename).toLowerCase();
	if (extension === ".jpeg" || extension === ".jpg") {
		return ".jpg";
	}
	if (extension === ".png" || extension === ".webp") {
		return extension;
	}
	return undefined;
};

const groupIds = <T extends Record<Key, number>, Key extends string>(
	rows: T[],
	groupKey: Key,
	idKey: Key,
): Map<number, number[]> => {
	const groups = new Map<number, number[]>();
	for (const row of rows) {
		const ids = groups.get(row[groupKey]) ?? [];
		ids.push(row[idKey]);
		groups.set(row[groupKey], ids);
	}
	return groups;
};

const imageForDJ = (dj: Selectable<DJsTable>): ArchiveDJImage | undefined => {
	if (dj.image === null && dj.image_filename === null) {
		return undefined;
	}
	if (dj.image === null || dj.image_filename === null) {
		throw new Error(`DJ ${dj.id} has incomplete image metadata`);
	}

	const extension = staticImageExtension(dj.image_filename);
	if (extension === undefined) {
		throw new Error(
			`DJ ${dj.id} has an unsupported image filename: ${dj.image_filename}`,
		);
	}

	return { id: dj.id, bytes: dj.image, extension };
};

/** Builds the public static-archive documents without writing to disk. */
export const buildArchiveDocuments = ({
	djs,
	shows,
	tags,
	showDJs,
	djTags,
	showTags,
}: BuildArchiveDocumentsParams): ArchiveDocuments => {
	const images = djs.flatMap((dj) => {
		const image = imageForDJ(dj);
		return image === undefined ? [] : [image];
	});
	const imagePaths = new Map(
		images.map((image) => [
			image.id,
			`assets/djs/${image.id}${image.extension}`,
		]),
	);
	const showsById = new Map(shows.map((show) => [show.id, show]));
	const showIdsByDJ = groupIds(showDJs, "dj_id", "show_id");
	const directTagIdsByDJ = groupIds(djTags, "dj_id", "tag_id");
	const tagIdsByShow = groupIds(showTags, "show_id", "tag_id");

	const djsWithTags = djs.map((dj) => {
		const showIds = showIdsByDJ.get(dj.id) ?? [];
		const showTagIds = showIds.flatMap(
			(showId) => tagIdsByShow.get(showId) ?? [],
		);
		const tagIds = [
			...new Set([...(directTagIdsByDJ.get(dj.id) ?? []), ...showTagIds]),
		].sort((first, second) => first - second);
		const showsForDJ = showIds
			.map((showId) => showsById.get(showId))
			.filter((show): show is Selectable<ShowsTable> => show !== undefined)
			.sort((first, second) => {
				const dateDifference = second.date.getTime() - first.date.getTime();
				return dateDifference === 0 ? first.id - second.id : dateDifference;
			})
			.map(
				(show): ArchiveShow => ({
					id: show.id,
					title: show.title,
					date: show.date,
					duration: show.duration,
					...(show.image === null ? {} : { image: show.image }),
					tagIds: tagIdsByShow.get(show.id) ?? [],
					url: show.url,
				}),
			);

		return { dj, tagIds, shows: showsForDJ };
	});

	const djsBrief = djsWithTags.map(({ dj, tagIds }) => {
		const image = imagePaths.get(dj.id);
		return {
			id: dj.id,
			title: dj.title,
			...(image === undefined ? {} : { image }),
			tagIds,
		};
	});
	const archiveDJs = djsWithTags.map(({ dj, tagIds, shows: djShows }) => {
		const image = imagePaths.get(dj.id);
		return {
			id: dj.id,
			title: dj.title,
			...(image === undefined ? {} : { image }),
			bio: sanitizeArchiveHtml(dj.bio),
			...(dj.socials === null
				? {}
				: { socials: sanitizeArchiveHtml(dj.socials) }),
			...(dj.showTitle === null ? {} : { showTitle: dj.showTitle }),
			...(dj.showDescription === null
				? {}
				: { showDescription: dj.showDescription }),
			shows: djShows,
			tagIds,
		};
	});

	return {
		djsBrief,
		djs: archiveDJs,
		tags: tags.map((tag) => ({
			id: tag.id,
			title: tag.title,
			color: tag.color,
			...(tag.mixcloud_key === null ? {} : { mixcloud_key: tag.mixcloud_key }),
			...(tag.mixcloud_url === null ? {} : { mixcloud_url: tag.mixcloud_url }),
		})),
		images,
	};
};

const writeJSON = async (file: string, value: unknown): Promise<void> => {
	await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
};

/** Replaces exporter-owned DJ assets while preserving unrelated archive files. */
export const writeArchiveDocuments = async (
	documents: ArchiveDocuments,
	resourceDirectory: string,
	assetDirectory: string,
	reporter: ArchiveExportReporter = { log: console.log },
): Promise<void> => {
	if (!path.isAbsolute(resourceDirectory) || !path.isAbsolute(assetDirectory)) {
		throw new Error("Archive output directories must be absolute paths");
	}

	reporter.log("├─ Refreshing managed JSON output");
	await fs.mkdir(resourceDirectory, { recursive: true });
	for (const relativePath of ["djs", "djs_brief.json", "tags.json"]) {
		await fs.rm(path.join(resourceDirectory, relativePath), {
			recursive: true,
			force: true,
		});
		reporter.log(`│  ├─ Removed ${relativePath}`);
	}
	reporter.log("│  └─ Preserved unrelated JSON resources");
	reporter.log("├─ Refreshing managed image output");
	await fs.mkdir(assetDirectory, { recursive: true });
	await fs.rm(path.join(assetDirectory, "djs"), {
		recursive: true,
		force: true,
	});
	reporter.log("│  ├─ Removed djs/");
	reporter.log("│  └─ Preserved unrelated image assets");

	reporter.log("├─ Writing JSON");
	await fs.mkdir(path.join(resourceDirectory, "djs"), { recursive: true });
	await writeJSON(
		path.join(resourceDirectory, "djs_brief.json"),
		documents.djsBrief,
	);
	reporter.log(`│  ├─ djs_brief.json: ${documents.djsBrief.length} DJs`);
	for (const dj of documents.djs) {
		await writeJSON(path.join(resourceDirectory, "djs", `${dj.id}.json`), dj);
		reporter.log(`│  ├─ djs/${dj.id}.json`);
	}
	await writeJSON(path.join(resourceDirectory, "tags.json"), documents.tags);
	reporter.log(`│  └─ tags.json: ${documents.tags.length} tags`);

	reporter.log("├─ Writing image assets");
	if (documents.images.length === 0) {
		reporter.log("│  └─ No DJ images");
	} else {
		await fs.mkdir(path.join(assetDirectory, "djs"), {
			recursive: true,
		});
		for (const [index, image] of documents.images.entries()) {
			const relativePath = `assets/djs/${image.id}${image.extension}`;
			await fs.writeFile(
				path.join(assetDirectory, "djs", `${image.id}${image.extension}`),
				image.bytes,
			);
			const branch = index === documents.images.length - 1 ? "└─" : "├─";
			reporter.log(`│  ${branch} ${relativePath}`);
		}
	}
	reporter.log(
		`└─ Complete: ${documents.djs.length} DJs, ${documents.tags.length} tags, ${documents.images.length} images`,
	);
};

/** Loads archive data, builds public files, and writes the DJ export. */
export const exportArchive = async (
	database: Kysely<Database> = db,
	resourceDirectory: string = ARCHIVE_RESOURCE_DIRECTORY,
	assetDirectory: string = ARCHIVE_ASSET_DIRECTORY,
	reporter: ArchiveExportReporter = { log: console.log },
): Promise<void> => {
	reporter.log("Archive export");
	reporter.log(`├─ JSON destination: ${resourceDirectory}`);
	reporter.log(`├─ Image destination: ${assetDirectory}`);
	reporter.log("├─ Reading database");
	const [djs, shows, tags, showDJs, djTags, showTags] = await Promise.all([
		database
			.selectFrom("djs")
			.selectAll()
			.orderBy("title")
			.orderBy("id")
			.execute(),
		database
			.selectFrom("shows")
			.selectAll()
			.orderBy("date", "desc")
			.orderBy("id")
			.execute(),
		database
			.selectFrom("tags")
			.select(["id", "title", "color", "mixcloud_key", "mixcloud_url"])
			.orderBy("id")
			.execute(),
		database
			.selectFrom("show_djs")
			.select(["dj_id", "show_id"])
			.orderBy("dj_id")
			.orderBy("show_id")
			.execute(),
		database
			.selectFrom("dj_tags")
			.select(["dj_id", "tag_id"])
			.orderBy("dj_id")
			.orderBy("tag_id")
			.execute(),
		database
			.selectFrom("show_tags")
			.select(["show_id", "tag_id"])
			.orderBy("show_id")
			.orderBy("tag_id")
			.execute(),
	]);
	reporter.log(`│  ├─ DJs: ${djs.length}`);
	reporter.log(`│  ├─ Tags: ${tags.length}`);
	reporter.log(`│  ├─ DJ/show relationships: ${showDJs.length}`);
	reporter.log(`│  ├─ Direct DJ tags: ${djTags.length}`);
	reporter.log(`│  └─ Show tags: ${showTags.length}`);
	reporter.log("├─ Building archive documents");
	const documents = buildArchiveDocuments({
		djs,
		shows,
		tags,
		showDJs,
		djTags,
		showTags,
	});
	reporter.log(`│  ├─ DJ details: ${documents.djs.length}`);
	reporter.log(`│  ├─ DJ briefs: ${documents.djsBrief.length}`);
	reporter.log(`│  ├─ Tags: ${documents.tags.length}`);
	reporter.log(`│  └─ Images: ${documents.images.length}`);

	await writeArchiveDocuments(
		documents,
		resourceDirectory,
		assetDirectory,
		reporter,
	);
};

// TODO: Export the top-level shows.json index in a separate feature.
if (import.meta.main) {
	try {
		await exportArchive();
	} catch (error) {
		console.error("└─ Archive export failed", error);
		process.exitCode = 1;
	} finally {
		await db.destroy();
	}
}
