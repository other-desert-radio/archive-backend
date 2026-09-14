/*
 * JSON output:
[{
    id: 1,
    title: "title",
    date: "date",
    duration: 1234, // in seconds
    djs: [id],
    image: "...",
    tags: [id, id],
    url: "string", // where audio comes from
}, ...]

Show_DJs: ID | show_id | dj_id show_id FOREIGN KEY -> Shows.ID dj_id FOREIGN KEY
*/

import { groupRelationshipIds } from "../utils/relationship-ids.js";
import type { ShowsJSON, TransformShowsParams } from "./types.js";

export const transformShows = ({
	shows,
	showDJs,
}: TransformShowsParams): ShowsJSON => {
	// gathers djs into Map { showId => [DJ_ID, DJ_ID] }
	const djsForShow = groupRelationshipIds({
		rows: showDJs,
		groupId: "show_id",
		gatherId: "dj_id",
	});

	return shows.map((show) => ({
		id: show.id,
		title: show.title,
		date: show.date,
		duration: show.duration,
		image: show.image,
		url: show.url,
		djs: djsForShow.get(show.id) ?? [],
		tags: [],

		// TODO:
		//tags:
		//djs:
	}));
};
