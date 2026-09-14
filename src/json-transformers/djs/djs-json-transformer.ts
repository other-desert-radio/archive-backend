import {
	groupRelationshipIds,
	mergeRelationshipIds,
} from "../utils/relationship-ids.js";
import type { DJsJSON, TransformDJsParams } from "./types.js";

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
 *     "image": "dj-one.jpg",
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
}: TransformDJsParams): DJsJSON[] => {
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
		title: dj.title,
		bio: dj.bio,
		...(dj.image === null ? {} : { image: dj.image }),
		shows: showsByDj.get(dj.id) ?? [],
		tags: tagsByDj.get(dj.id) ?? [],
	}));
};
