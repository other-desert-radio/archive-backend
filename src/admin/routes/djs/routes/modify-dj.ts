import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { generateSquareWebPImages } from "../../../../utils/images/index.js";
import { plainTextToSafeHtml } from "../../../../utils/plain-text-to-safe-html.js";
import { clientDescription } from "../../../logging.js";
import { createTags } from "../../tags/tag-service.js";
import type { TypedDatabase } from "../../types.js";
import { normalizeCreateDJRequest } from "../normalize-create-dj-request.js";
import { parseModifyDJMultipart } from "../parse-modify-dj-multipart.js";
import type { AdminDJJSON, ModifyDJRoute } from "../types.js";
import { ModifyDJRequestPattern } from "../types.js";
import { validateDJImageUpload } from "../validate-dj-image.js";

export const modifyDJHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ModifyDJRoute>,
		reply: FastifyReply<ModifyDJRoute>,
	) => {
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
			textRequest.title = textRequest.title.trim();
			textRequest.bio = textRequest.bio.trim();
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
					error: "An image cannot be replaced and removed in the same request",
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
							.innerJoin("show_tags", "show_tags.show_id", "show_djs.show_id")
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
					`[DJ Modification] image upload rejected -- route: /api/admin/modify-dj, status: 413, field: image, limit: 10 MiB, client: ${client}`,
				);
				return reply.code(413).send({ error: "Image must not exceed 10 MiB" });
			}
			request.log.error({ err: error }, "Unable to modify DJ");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
