import type { FastifyPluginAsync } from "fastify";
import { isMatching } from "ts-pattern";
import type { DJJSON } from "../../../json-transformers/index.js";
import { transformDJs } from "../../../json-transformers/index.js";
import { plainTextToSafeHtml } from "../../../utils/plain-text-to-safe-html.js";
import { createTags } from "../tags/tag-service.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";
import { normalizeCreateDJRequest } from "./normalize-create-dj-request.js";
import { type CreateDJRequest, CreateDJRequestPattern } from "./types.js";

/** Registers authenticated DJ API routes. */
export const djRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.get<{ Reply: AdminApiReply<DJJSON[]> }>(
			"/djs",
			async (request, reply) => {
				try {
					const [djs, showDJs, djTags, showTags] = await Promise.all([
						database
							.selectFrom("djs")
							.select(["id", "createdAt", "title", "bio", "image", "socials"])
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
				} catch (error) {
					request.log.error(error, "Unable to load DJs");
					return reply.code(500).send({ error: "Internal Server Error" });
				}
			},
		);

		app.post<{ Body: CreateDJRequest; Reply: AdminApiReply<DJJSON> }>(
			"/create-dj",
			async (request, reply) => {
				if (!isMatching(CreateDJRequestPattern, request.body)) {
					return reply.code(400).send({ error: "Validation error" });
				}

				try {
					const normalized = normalizeCreateDJRequest(request.body);
					const created = await database
						.transaction()
						.execute(async (transaction) => {
							const createdTags = await createTags(
								transaction,
								normalized.tags.map((title) => ({ title })),
							);
							const tagIds = createdTags.map((tag) => tag.id);

							const insertedDJ = await transaction
								.insertInto("djs")
								.values({
									title: normalized.title,
									bio: plainTextToSafeHtml(normalized.bio),
									image: normalized.image,
									socials:
										normalized.socials === null
											? undefined
											: plainTextToSafeHtml(normalized.socials),
								})
								.returning("id")
								.executeTakeFirstOrThrow();

							if (tagIds.length > 0) {
								await transaction
									.insertInto("dj_tags")
									.values(
										tagIds.map((tagId) => ({
											dj_id: insertedDJ.id,
											tag_id: tagId,
										})),
									)
									.execute();
							}

							return {
								id: insertedDJ.id,
								title: normalized.title,
								bio: plainTextToSafeHtml(normalized.bio),
								...(normalized.image === null
									? {}
									: { image: normalized.image }),
								...(normalized.socials === null
									? {}
									: { socials: plainTextToSafeHtml(normalized.socials) }),
								shows: [],
								tags: tagIds,
							};
						});

					return reply.code(201).send(created);
				} catch (error) {
					request.log.error(error, "Unable to create DJ");
					return reply.code(500).send({ error: "Internal Server Error" });
				}
			},
		);

		app.post("/modify-dj", async () => {
			return undefined;
		});

		app.post("/remove-dj", async () => {
			// soft delete
			return undefined;
		});
	};
