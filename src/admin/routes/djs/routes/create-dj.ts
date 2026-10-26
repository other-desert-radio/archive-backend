import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { generateSquareWebPImages } from "../../../../utils/images/index.js";
import { plainTextToSafeHtml } from "../../../../utils/plain-text-to-safe-html.js";
import { clientDescription } from "../../../logging.js";
import { createTags } from "../../tags/tag-service.js";
import type { TypedDatabase } from "../../types.js";
import { normalizeCreateDJRequest } from "../normalize-create-dj-request.js";
import { parseCreateDJMultipart } from "../parse-create-dj-multipart.js";
import type { CreateDJRoute } from "../types.js";
import { CreateDJRequestPattern } from "../types.js";
import { validateDJImageUpload } from "../validate-dj-image.js";

export const createDJHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<CreateDJRoute>,
		reply: FastifyReply<CreateDJRoute>,
	) => {
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
			textRequest.title = textRequest.title.trim();
			textRequest.bio = textRequest.bio.trim();

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
			if (
				error instanceof request.server.multipartErrors.RequestFileTooLargeError
			) {
				const client = clientDescription(request);
				request.log.warn(
					{
						statusCode: 413,
						field: "image",
						maxFileBytes: 10 * 1024 * 1024,
						client,
					},
					`[DJ Creation] image upload rejected -- route: /api/admin/create-dj, status: 413, field: image, limit: 10 MiB, client: ${client}`,
				);
				return reply.code(413).send({ error: "Image must not exceed 10 MiB" });
			}
			request.log.error({ err: error }, "Unable to create DJ");
			return reply.code(500).send({
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};
