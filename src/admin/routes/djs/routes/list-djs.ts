import type { FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { transformDJs } from "../../../../json-transformers/index.js";
import type { TypedDatabase } from "../../types.js";
import type { ListDJsRoute } from "../types.js";

export const listDJsHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ListDJsRoute>,
		reply: FastifyReply<ListDJsRoute>,
	) => {
		try {
			const [djs, showDJs, djTags, showTags] = await Promise.all([
				database
					.selectFrom("djs")
					.select([
						"id",
						"createdAt",
						"title",
						"bio",
						// The transformer needs presence only; keep photo bytes out of list reads.
						sql<Buffer | null>`case when image_small is null then null else ''::bytea end`.as(
							"image_small",
						),
						sql<Buffer | null>`case when image_large is null then null else ''::bytea end`.as(
							"image_large",
						),
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

			const directTagsByDJ = new Map<number, number[]>();
			for (const { dj_id: djId, tag_id: tagId } of djTags) {
				const tagIds = directTagsByDJ.get(djId) ?? [];
				tagIds.push(tagId);
				directTagsByDJ.set(djId, tagIds);
			}

			return transformDJs({ djs, showDJs, djTags, showTags }).map((dj) => ({
				...dj,
				// Keep direct assignments separate so the edit form never promotes
				// show-inherited tags into DJ-owned tags when it saves.
				directTags: directTagsByDJ.get(dj.id) ?? [],
			}));
		} catch (error) {
			request.log.error(error, "Unable to load DJs");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
