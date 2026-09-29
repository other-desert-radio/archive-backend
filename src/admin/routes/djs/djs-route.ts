import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import type { DJJSON } from "../../../json-transformers/index.js";
import { transformDJs } from "../../../json-transformers/index.js";
import { generateSquareWebPImages } from "../../../utils/images/index.js";
import { plainTextToSafeHtml } from "../../../utils/plain-text-to-safe-html.js";
import { clientDescription } from "../../logging.js";
import { createTags } from "../tags/tag-service.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";
import { normalizeCreateDJRequest } from "./normalize-create-dj-request.js";
import { parseCreateDJMultipart } from "./parse-create-dj-multipart.js";
import { parseModifyDJMultipart } from "./parse-modify-dj-multipart.js";
import { CreateDJRequestPattern, ModifyDJRequestPattern } from "./types.js";
import { validateDJImageUpload } from "./validate-dj-image.js";

/**
 * Extends the combined public-style relationship list with tags assigned
 * directly to the DJ. `tags` can also include tags inherited from linked shows.
 */
type AdminDJJSON = DJJSON & { directTags: number[] };

/** Registers authenticated DJ API routes. */
export const djRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.get<{ Reply: AdminApiReply<AdminDJJSON[]> }>(
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
								"image_small",
								"image_large",
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
			},
		);

		const serveImage = async (
			id: string,
			variant: string,
			request: FastifyRequest,
			reply: FastifyReply,
		) => {
			const numericId = Number(id);
			if (!Number.isSafeInteger(numericId) || numericId < 1)
				return reply.code(404).send({ error: "Not Found" });
			if (variant !== "small" && variant !== "large")
				return reply.code(404).send({ error: "Not Found" });

			try {
				const dj = await database
					.selectFrom("djs")
					.select(variant === "small" ? ["image_small"] : ["image_large"])
					.where("id", "=", numericId)
					.executeTakeFirst();
				const image = variant === "small" ? dj?.image_small : dj?.image_large;
				if (image === null || image === undefined)
					return reply.code(404).send({ error: "Not Found" });

				reply.type("image/webp");
				return reply.code(200).send(image);
			} catch (error) {
				request.log.error(error, "Unable to load DJ image");
				return reply.code(500).send({ error: "Internal Server Error" });
			}
		};

		app.get<{
			Params: { id: string; variant: "small" | "large" };
			Reply: AdminApiReply<Buffer>;
		}>("/djs/:id/image/:variant", (request, reply) =>
			serveImage(request.params.id, request.params.variant, request, reply),
		);

		app.get<{
			Params: { id: string };
			Reply: AdminApiReply<Buffer>;
		}>("/djs/:id/image", (request, reply) =>
			serveImage(request.params.id, "large", request, reply),
		);

		app.post<{ Reply: AdminApiReply<DJJSON> }>(
			"/create-dj",
			async (request, reply) => {
				request.log.info(
					{ client: clientDescription(request) },
					"[DJ Creation] started",
				);
				try {
					const parsed = await parseCreateDJMultipart(request);
					if (!parsed.valid) {
						request.log.warn(
							{ reason: parsed.error },
							"DJ creation request rejected during multipart parsing",
						);
						return reply.code(400).send({ error: parsed.error });
					}

					const { image: uploadedImage, ...textRequest } = parsed.form;

					if (!isMatching(CreateDJRequestPattern, textRequest)) {
						request.log.warn(
							"DJ creation request rejected during field validation",
						);
						return reply.code(400).send({ error: "Validation error" });
					}

					const validatedImage =
						uploadedImage === undefined
							? undefined
							: validateDJImageUpload(uploadedImage);
					if (validatedImage?.valid === false) {
						request.log.warn(
							{ reason: validatedImage.error },
							"DJ creation request rejected during image validation",
						);
						return reply.code(400).send({ error: validatedImage.error });
					}

					const image =
						validatedImage?.valid === true ? validatedImage.image : undefined;
					let imageVariants:
						| Awaited<ReturnType<typeof generateSquareWebPImages>>
						| undefined;
					if (image !== undefined) {
						try {
							imageVariants = await generateSquareWebPImages(image.bytes);
						} catch (error) {
							request.log.warn(
								{ err: error },
								"DJ creation request rejected during image processing",
							);
							return reply
								.code(400)
								.send({ error: "Image could not be processed" });
						}
					}
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
									image_small: imageVariants?.small ?? null,
									image_large: imageVariants?.large ?? null,
									socials:
										normalized.socials === null
											? undefined
											: plainTextToSafeHtml(normalized.socials),
									...(normalized.showTitle === null
										? {}
										: { showTitle: normalized.showTitle }),
									...(normalized.showDescription === null
										? {}
										: { showDescription: normalized.showDescription }),
								})
								.returning(["id", "createdAt"])
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
								createdAt: insertedDJ.createdAt,
								title: normalized.title,
								bio: plainTextToSafeHtml(normalized.bio),
								...(imageVariants === undefined
									? {}
									: {
											image_small: `/api/admin/djs/${insertedDJ.id}/image/small`,
											image_large: `/api/admin/djs/${insertedDJ.id}/image/large`,
										}),
								...(normalized.socials === null
									? {}
									: { socials: plainTextToSafeHtml(normalized.socials) }),
								...(normalized.showTitle === null
									? {}
									: { showTitle: normalized.showTitle }),
								...(normalized.showDescription === null
									? {}
									: { showDescription: normalized.showDescription }),
								shows: [],
								tags: tagIds,
							};
						});

					request.log.info(
						{
							djId: created.id,
							djName: created.title,
							hasImage: imageVariants !== undefined,
							...(imageVariants === undefined
								? {}
								: {
										imageSmallBytes: imageVariants.small.length,
										imageLargeBytes: imageVariants.large.length,
									}),
							client: clientDescription(request),
						},
						`[DJ Creation] DJ created -- id: ${created.id}, name: ${created.title}`,
					);
					return reply.code(201).send(created);
				} catch (error) {
					request.log.error({ err: error }, "Unable to create DJ");
					return reply.code(500).send({
						error: error instanceof Error ? error.message : String(error),
					});
				}
			},
		);

		app.post<{ Reply: AdminApiReply<AdminDJJSON> }>(
			"/modify-dj",
			async (request, reply) => {
				request.log.info(
					{ client: clientDescription(request) },
					"[DJ Modification] started",
				);
				try {
					const parsed = await parseModifyDJMultipart(request);
					if (!parsed.valid) {
						request.log.warn(
							{ reason: parsed.error },
							"DJ modification request rejected during multipart parsing",
						);
						return reply.code(400).send({ error: parsed.error });
					}

					const { image: uploadedImage, ...textRequest } = parsed.form;
					if (!isMatching(ModifyDJRequestPattern, textRequest)) {
						request.log.warn(
							"DJ modification request rejected during field validation",
						);
						return reply.code(400).send({ error: "Validation error" });
					}
					if (textRequest.removeImage && uploadedImage !== undefined) {
						request.log.warn(
							"DJ modification request rejected because image replacement and removal were both requested",
						);
						return reply.code(400).send({
							error:
								"An image cannot be replaced and removed in the same request",
						});
					}

					const validatedImage =
						uploadedImage === undefined
							? undefined
							: validateDJImageUpload(uploadedImage);
					if (validatedImage?.valid === false) {
						request.log.warn(
							{ reason: validatedImage.error },
							"DJ modification request rejected during image validation",
						);
						return reply.code(400).send({ error: validatedImage.error });
					}

					let imageVariants:
						| Awaited<ReturnType<typeof generateSquareWebPImages>>
						| undefined;
					if (validatedImage?.valid === true) {
						try {
							imageVariants = await generateSquareWebPImages(
								validatedImage.image.bytes,
							);
						} catch (error) {
							request.log.warn(
								{ err: error },
								"DJ modification request rejected during image processing",
							);
							return reply
								.code(400)
								.send({ error: "Image could not be processed" });
						}
					}

					const normalized = normalizeCreateDJRequest(textRequest);
					const safeBio = plainTextToSafeHtml(normalized.bio);
					const safeSocials =
						normalized.socials === null
							? null
							: plainTextToSafeHtml(normalized.socials);
					const modified = await database
						.transaction()
						.execute(async (transaction) => {
							const updated = await transaction
								.updateTable("djs")
								.set({
									title: normalized.title,
									bio: safeBio,
									socials: safeSocials,
									showTitle: normalized.showTitle,
									showDescription: normalized.showDescription,
									...(imageVariants === undefined
										? textRequest.removeImage
											? { image_small: null, image_large: null }
											: {}
										: {
												image_small: imageVariants.small,
												image_large: imageVariants.large,
											}),
								})
								.where("id", "=", textRequest.id)
								.returning([
									"id",
									"createdAt",
									"title",
									"bio",
									"image_small",
									"image_large",
									"socials",
									"showTitle",
									"showDescription",
								])
								.executeTakeFirst();
							if (updated === undefined) return undefined;

							const createdTags = await createTags(
								transaction,
								normalized.tags.map((title) => ({ title })),
							);
							const directTagIds = createdTags.map((tag) => tag.id);
							await transaction
								.deleteFrom("dj_tags")
								.where("dj_id", "=", updated.id)
								.execute();
							if (directTagIds.length > 0) {
								await transaction
									.insertInto("dj_tags")
									.values(
										directTagIds.map((tagId) => ({
											dj_id: updated.id,
											tag_id: tagId,
										})),
									)
									.execute();
							}

							const [shows, inheritedTags] = await Promise.all([
								transaction
									.selectFrom("show_djs")
									.select("show_id")
									.where("dj_id", "=", updated.id)
									.orderBy("show_id")
									.execute(),
								transaction
									.selectFrom("show_djs")
									.innerJoin(
										"show_tags",
										"show_tags.show_id",
										"show_djs.show_id",
									)
									.select("show_tags.tag_id")
									.where("show_djs.dj_id", "=", updated.id)
									.orderBy("show_tags.tag_id")
									.execute(),
							]);

							return { updated, directTagIds, shows, inheritedTags };
						});
					if (modified === undefined)
						return reply.code(404).send({ error: "Not Found" });

					const allTagIds = [
						...new Set([
							...modified.directTagIds,
							...modified.inheritedTags.map(({ tag_id: tagId }) => tagId),
						]),
					].sort((left, right) => left - right);
					const response: AdminDJJSON = {
						id: modified.updated.id,
						createdAt: modified.updated.createdAt,
						title: modified.updated.title,
						bio: modified.updated.bio,
						...(modified.updated.image_small === null ||
						modified.updated.image_large === null
							? {}
							: {
									image_small: `/api/admin/djs/${modified.updated.id}/image/small`,
									image_large: `/api/admin/djs/${modified.updated.id}/image/large`,
								}),
						...(modified.updated.socials === null
							? {}
							: { socials: modified.updated.socials }),
						...(modified.updated.showTitle === null
							? {}
							: { showTitle: modified.updated.showTitle }),
						...(modified.updated.showDescription === null
							? {}
							: { showDescription: modified.updated.showDescription }),
						shows: modified.shows.map(({ show_id: showId }) => showId),
						tags: allTagIds,
						directTags: modified.directTagIds,
					};
					request.log.info(
						{
							djId: response.id,
							djName: response.title,
							hasImage: response.image_large !== undefined,
							imageRemoved: textRequest.removeImage,
							client: clientDescription(request),
						},
						`[DJ Modification] DJ modified -- id: ${response.id}, name: ${response.title}`,
					);
					return reply.code(200).send(response);
				} catch (error) {
					request.log.error({ err: error }, "Unable to modify DJ");
					return reply.code(500).send({ error: "Internal Server Error" });
				}
			},
		);

		app.post("/remove-dj", async () => {
			// soft delete
			return undefined;
		});
	};
