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

					return transformDJs({ djs, showDJs, djTags, showTags });
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

		app.post("/modify-dj", async () => {
			return undefined;
		});

		app.post("/remove-dj", async () => {
			// soft delete
			return undefined;
		});
	};
