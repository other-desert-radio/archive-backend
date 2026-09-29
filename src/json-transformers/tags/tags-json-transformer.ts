import { logger } from "../../utils/index.js";
import type { TagsJSON, TransformTagsParams } from "./types.js";

/**
 * Converts tag rows into the public tag JSON shape.
 *
 * Tags contain their display title and color. Relationship data is not
 * included here; DJs and shows expose their related tag IDs in their own
 * transformed output.
 *
 * @example
 * ```json
 * [
 *   {
 *     "id": 20,
 *     "title": "House",
 *     "color": "#ff6b6b"
 *   },
 *   {
 *     "id": 21,
 *     "title": "Guest Mix",
 *     "color": "#4dabf7",
 *     "reviewed": true
 *   }
 * ]
 * ```
 */
export const transformTags = ({ tags }: TransformTagsParams): TagsJSON[] => {
	logger.verbose("Transforming tags", { tagCount: tags.length });

	return tags.map((tag) => ({
		id: tag.id,
		title: tag.title,
		color: tag.color,
		reviewed: tag.reviewed,
		...(tag.mixcloud_key === null ? {} : { mixcloud_key: tag.mixcloud_key }),
		...(tag.mixcloud_url === null ? {} : { mixcloud_url: tag.mixcloud_url }),
	}));
};
