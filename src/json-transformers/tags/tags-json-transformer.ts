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
 *     "color": "#4dabf7"
 *   }
 * ]
 * ```
 */
export const transformTags = ({ tags }: TransformTagsParams): TagsJSON[] => {
	return tags.map((tag) => ({
		id: tag.id,
		title: tag.title,
		color: tag.color,
	}));
};
