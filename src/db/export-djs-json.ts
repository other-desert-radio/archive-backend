import type { Kysely } from "kysely";
import type { DJJSON } from "../json-transformers/index.js";
import { transformDJs } from "../json-transformers/index.js";
import { db } from "./db.js";
import type { Database } from "./types.js";

/** Loads all DJ data and converts it to the public JSON shape. */
export const exportDJsJSON = async (
	database: Kysely<Database> = db,
): Promise<DJJSON[]> => {
	const [djs, showDJs, djTags, showTags] = await Promise.all([
		database
			.selectFrom("djs")
			.select([
				"id",
				"createdAt",
				"title",
				"bio",
				"image",
				"image_filename",
				"socials",
				"showTitle",
				"showDescription",
			])
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
			.selectFrom("show_djs")
			.innerJoin("show_tags", "show_tags.show_id", "show_djs.show_id")
			.select(["show_djs.dj_id", "show_tags.tag_id"])
			.orderBy("show_djs.dj_id")
			.orderBy("show_tags.tag_id")
			.execute(),
	]);

	return transformDJs({ djs, showDJs, djTags, showTags });
};

if (import.meta.main) {
	try {
		// The transformer logs diagnostics through console.debug. Keep stdout
		// reserved for the JSON payload so this command can be piped safely.
		const debug = console.debug;
		console.debug = console.error;
		try {
			console.log(JSON.stringify(await exportDJsJSON(), null, 2));
		} finally {
			console.debug = debug;
		}
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	} finally {
		await db.destroy();
	}
}
