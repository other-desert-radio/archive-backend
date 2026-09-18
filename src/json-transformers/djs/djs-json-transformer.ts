import { logger } from "../../utils/index.js";
import { sanitizeArchiveHtml } from "../../utils/sanitize-html.js";
import {
	groupRelationshipIds,
	mergeRelationshipIds,
} from "../utils/relationship-ids.js";
import type { DJJSON, TransformDJsParams } from "./types.js";

/**
 * Converts DJ rows and relationship rows into the public DJ JSON shape.
 *
 * Each DJ includes the IDs of their related shows and tags. Tags assigned
 * directly to a DJ and tags inherited through their shows are merged,
 * deduplicated, and sorted. DJs without relationships receive empty arrays,
 * and nullable images are omitted.
 *
 * @example
 * ```json
 * [
 *   {
 *     "id": 1,
 *     "title": "DJ One",
 *     "bio": "A resident DJ.",
 *     "imagePath": "/api/admin/djs/1/image",
 *     "shows": [10, 11],
 *     "tags": [20, 21]
 *   },
 *   {
 *     "id": 2,
 *     "title": "DJ Two",
 *     "bio": "A guest DJ.",
 *     "shows": [],
 *     "tags": []
 *   }
 * ]
 * ```
 */
export const transformDJs = ({
	djs,
	showDJs,
	djTags,
	showTags,
}: TransformDJsParams): DJJSON[] => {
	logger.verbose("Transforming DJs", {
		djCount: djs.length,
		showRelationshipCount: showDJs.length,
		directTagRelationshipCount: djTags.length,
		showTagRelationshipCount: showTags.length,
	});

	const showsByDj = groupRelationshipIds({
		rows: showDJs,
		groupKey: "dj_id",
		idKey: "show_id",
	});
	const tagsByDj = mergeRelationshipIds(
		groupRelationshipIds({
			rows: djTags,
			groupKey: "dj_id",
			idKey: "tag_id",
		}),
		groupRelationshipIds({
			rows: showTags,
			groupKey: "dj_id",
			idKey: "tag_id",
		}),
	);

	return djs.map((dj) => ({
		id: dj.id,
		createdAt: dj.createdAt,
		title: dj.title,
		bio: sanitizeArchiveHtml(dj.bio),
		...(dj.image_filename == null
			? {}
			: { imagePath: `/api/admin/djs/${dj.id}/image` }),
		...(dj.socials === null
			? {}
			: { socials: sanitizeArchiveHtml(dj.socials) }),
		...(dj.showTitle === null ? {} : { showTitle: dj.showTitle }),
		...(dj.showDescription === null
			? {}
			: { showDescription: dj.showDescription }),
		shows: showsByDj.get(dj.id) ?? [],
		tags: tagsByDj.get(dj.id) ?? [],
	}));
};
