import { isDatabaseId } from "../../../utils/index.js";
import type { TypedDatabase } from "../types.js";
import type { TagDeleteImpact } from "./types.js";

/**
 * Builds the read-only impact preview for a tag's deletion confirmation.
 *
 * Shows are affected through their show_tags assignments. DJs are affected
 * either directly through dj_tags or by inheriting the tag through a linked
 * Show. Each DJ appears once, with assignment set to direct, inherited, or both;
 * inheriting through multiple Shows does not produce duplicate entries.
 * Both resource lists are sorted by title, then ID, and may be empty.
 *
 * These separate reads do not lock records or provide a transactional snapshot.
 * The preview is advisory: assignments may change before deletion, which removes
 * all tag assignments present when the delete statement executes.
 *
 * @param database - Typed database used to read the tag and its relationships.
 * @param id - Tag ID, already validated as a positive safe integer by the caller.
 * @returns Tag identity and affected resources, or undefined if the tag is absent
 * or the ID exceeds the PostgreSQL integer range used by archive records.
 * @throws Propagates database failures for the route's logging and error handling.
 */
export const loadTagDeleteImpact = async (
	database: TypedDatabase,
	id: number,
): Promise<TagDeleteImpact | undefined> => {
	// Archive IDs are PostgreSQL integers; larger valid request IDs cannot exist.
	if (!isDatabaseId(id)) return undefined;
	const tag = await database
		.selectFrom("tags")
		.select(["id", "title"])
		.where("id", "=", id)
		.executeTakeFirst();
	if (tag === undefined) return undefined;
	const [shows, direct, inherited] = await Promise.all([
		database
			.selectFrom("show_tags")
			.innerJoin("shows", "shows.id", "show_tags.show_id")
			.select(["shows.id", "shows.title"])
			.where("show_tags.tag_id", "=", id)
			.distinct()
			.execute(),
		database
			.selectFrom("dj_tags")
			.innerJoin("djs", "djs.id", "dj_tags.dj_id")
			.select(["djs.id", "djs.title"])
			.where("dj_tags.tag_id", "=", id)
			.distinct()
			.execute(),
		database
			.selectFrom("show_tags")
			.innerJoin("show_djs", "show_djs.show_id", "show_tags.show_id")
			.innerJoin("djs", "djs.id", "show_djs.dj_id")
			.select(["djs.id", "djs.title"])
			.where("show_tags.tag_id", "=", id)
			.distinct()
			.execute(),
	]);
	const djs = new Map<number, TagDeleteImpact["djs"][number]>();
	for (const dj of direct) djs.set(dj.id, { ...dj, assignment: "direct" });
	for (const dj of inherited)
		djs.set(dj.id, {
			...dj,
			assignment: djs.has(dj.id) ? "both" : "inherited",
		});
	const compare = (
		left: { id: number; title: string },
		right: { id: number; title: string },
	) => left.title.localeCompare(right.title) || left.id - right.id;
	return {
		tag,
		shows: shows.sort(compare),
		djs: [...djs.values()].sort(compare),
	};
};
