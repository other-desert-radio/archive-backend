import { logger } from "../../utils/index.js";
import { groupRelationshipIds } from "../utils/relationship-ids.js";
import type { ShowsJSON, TransformShowsParams } from "./types.js";

/**
 * Converts show rows and relationship rows into the public show JSON shape.
 *
 * Each show includes the IDs of its related DJs and tags. Shows without
 * relationships receive empty arrays, and nullable images are omitted.
 * Durations are represented in seconds.
 *
 * @example
 * ```json
 * [
 *   {
 *     "id": 1,
 *     "title": "Show One",
 *     "date": "2026-01-01T00:00:00.000Z",
 *     "duration": 1234,
 *     "djs": [10, 11],
 *     "image": "show-one.jpg",
 *     "tags": [20, 21],
 *     "url": "https://example.com/show-one"
 *   },
 *   {
 *     "id": 2,
 *     "title": "Show Two",
 *     "date": "2026-01-02T00:00:00.000Z",
 *     "duration": 987,
 *     "djs": [],
 *     "tags": [],
 *     "url": "https://example.com/show-two"
 *   }
 * ]
 * ```
 */
export const transformShows = ({
	shows,
	showDJs,
	showTags,
}: TransformShowsParams): ShowsJSON[] => {
	logger.verbose("Transforming shows", {
		showCount: shows.length,
		djRelationshipCount: showDJs.length,
		tagRelationshipCount: showTags.length,
	});

	const djsForShow = groupRelationshipIds({
		rows: showDJs,
		groupKey: "show_id",
		idKey: "dj_id",
	});

	const tagsForShow = groupRelationshipIds({
		rows: showTags,
		groupKey: "show_id",
		idKey: "tag_id",
	});

	return shows.map((show) => ({
		id: show.id,
		title: show.title,
		date: show.date,
		duration: show.duration,
		...(show.image === null ? {} : { image: show.image }),
		url: show.url,
		djs: djsForShow.get(show.id) ?? [],
		tags: tagsForShow.get(show.id) ?? [],
	}));
};
