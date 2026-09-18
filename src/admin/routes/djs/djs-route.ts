import type { FastifyPluginAsync } from "fastify";
import { isMatching } from "ts-pattern";
import type { DJJSON } from "../../../json-transformers/index.js";
import { transformDJs } from "../../../json-transformers/index.js";
import { plainTextToSafeHtml } from "../../../utils/plain-text-to-safe-html.js";
import { createTags } from "../tags/tag-service.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";
import { normalizeCreateDJRequest } from "./normalize-create-dj-request.js";
import { parseCreateDJMultipart } from "./parse-create-dj-multipart.js";
import { CreateDJRequestPattern } from "./types.js";
import { validateDJImageUpload } from "./validate-dj-image.js";

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
							.select([
								"id",
								"createdAt",
								"title",
								"bio",
								"image",
								"image_filename",
								"socials",
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
				} catch (error) {
					request.log.error(error, "Unable to load DJs");
					return reply.code(500).send({ error: "Internal Server Error" });
				}
			},
		);

		app.post<{ Reply: AdminApiReply<DJJSON> }>(
			"/create-dj",
			async (request, reply) => {
				try {
					const parsed = await parseCreateDJMultipart(request);
					if (!parsed.valid) {
						return reply.code(400).send({ error: parsed.error });
					}

					const tags =
						parsed.form.tags === undefined
							? undefined
							: parsed.form.tags
									.split(",")
									.map((tag) => tag.trim())
									.filter((tag) => tag !== "");
					const socials =
						parsed.form.socials?.trim() === ""
							? undefined
							: parsed.form.socials;

					const textRequest = {
						title: parsed.form.title ?? "",
						bio: parsed.form.bio ?? "",
						...(tags === undefined ? {} : { tags }),
						...(socials === undefined ? {} : { socials }),
					};

					if (!isMatching(CreateDJRequestPattern, textRequest)) {
						return reply.code(400).send({ error: "Validation error" });
					}

					const validatedImage =
						parsed.form.image === undefined
							? undefined
							: validateDJImageUpload(parsed.form.image);
					if (validatedImage?.valid === false) {
						return reply.code(400).send({ error: validatedImage.error });
					}

					const image =
						validatedImage?.valid === true ? validatedImage.image : undefined;
					const normalized = normalizeCreateDJRequest(textRequest);
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
									image: image?.bytes ?? null,
									image_filename: image?.filename ?? null,
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

							const imagePath =
								image === undefined
									? undefined
									: `/api/admin/djs/${insertedDJ.id}/image`;

							return {
								id: insertedDJ.id,
								title: normalized.title,
								bio: plainTextToSafeHtml(normalized.bio),
								...(imagePath === undefined ? {} : { imagePath }),
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
