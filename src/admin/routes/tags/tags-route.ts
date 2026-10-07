import type { FastifyPluginAsync } from "fastify";
import { isMatching, match } from "ts-pattern";
import type { TagsJSON } from "../../../json-transformers/index.js";
import { transformTags } from "../../../json-transformers/index.js";
import { isDatabaseId } from "../../../utils/index.js";
import {
	type ValidateTagsResult,
	validateTags,
} from "../../../utils/validate-tags.js";
import { clientDescription } from "../../logging.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";
import { loadTagDeleteImpact } from "./delete-impact.js";
import {
	normalizeModifyTagRequest,
	TagEditValidationError,
} from "./normalize-modify-tag-request.js";
import { resolveMixcloudTags } from "./resolve-mixcloud-tags.js";
import { type CreatedTag, createTag, createTags } from "./tag-service.js";
import {
	type CreateTagRequest,
	CreateTagRequestPattern,
	type CreateTagsRequest,
	CreateTagsRequestPattern,
	type ModifyTagRequest,
	ModifyTagRequestPattern,
	type RemoveTagRequest,
	RemoveTagRequestPattern,
	type RemoveTagResponse,
	type ResolveMixcloudTagsResponse,
	type TagDeleteImpact,
	type ValidateTagsRequest,
	ValidateTagsRequestPattern,
} from "./types.js";

/** Registers authenticated Tags API routes. */
export const tagRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.get<{ Reply: AdminApiReply<TagsJSON[]> }>(
			"/tags",
			async (request, reply) => {
				try {
					const tags = await database
						.selectFrom("tags")
						.select([
							"id",
							"createdAt",
							"title",
							"color",
							"reviewed",
							"mixcloud_key",
							"mixcloud_url",
						])
						.orderBy("id")
						.execute();

					return transformTags({ tags });
				} catch (error) {
					request.log.error(error, "Unable to load tags");
					return reply.code(500).send({ error: "Internal Server Error" });
				}
			},
		);

		app.post<{
			Body: ValidateTagsRequest;
			Reply: AdminApiReply<ValidateTagsResult | ResolveMixcloudTagsResponse>;
		}>("/validate-tags", async (request, reply) => {
			try {
				if (!isMatching(ValidateTagsRequestPattern, request.body as unknown)) {
					request.log.warn("[Tag Validation] rejected -- invalid request body");
					return reply.code(400).send({
						error: "invalid request body, expected array of strings",
					});
				}

				if (request.body.mixcloud_keys !== undefined) {
					request.log.info(
						"[Mixcloud Tag Resolution] started -- /api/admin/validate-tags",
					);
					const tags = await database
						.selectFrom("tags")
						.select(["id", "title", "color", "mixcloud_key"])
						.execute();
					const result = resolveMixcloudTags(request.body.mixcloud_keys, tags);
					request.log.info(
						`[Mixcloud Tag Resolution] completed -- ${result.valid.length} matched, ${result.invalid.length} unresolved`,
					);
					return result;
				}
				const { tags } = request.body;
				const existingTags = await database
					.selectFrom("tags")
					.select("title")
					.execute();

				return validateTags({
					incomingTags: tags,
					existingTags: existingTags.map((tag) => tag.title),
				});
			} catch (error) {
				request.log.error(
					{ err: error },
					"[Tag Validation] failed -- /api/admin/validate-tags",
				);
				return reply.code(500).send({ error: "Internal Server Error" });
			}
		});

		// input: { title: string } | { title: string, color: string }
		app.post<{
			Body: CreateTagRequest;
			Reply: AdminApiReply<CreatedTag>;
		}>("/create-tag", async (request, reply) => {
			if (!isMatching(CreateTagRequestPattern, request.body)) {
				return reply.code(400).send({ error: "Validation error" });
			}

			try {
				return reply.code(201).send(await createTag(database, request.body));
			} catch (error) {
				request.log.error(error, "Unable to create tag");
				return reply.code(500).send({ error: "Internal Server Error" });
			}
		});
		// input: [{ title: string } | { title: string, color: string }]
		app.post<{
			Body: CreateTagsRequest;
			Reply: AdminApiReply<CreatedTag[]>;
		}>("/create-tags", async (request, reply) => {
			if (!isMatching(CreateTagsRequestPattern, request.body)) {
				return reply.code(400).send({ error: "Validation error" });
			}

			try {
				return reply.code(201).send(await createTags(database, request.body));
			} catch (error) {
				request.log.error(error, "Unable to create tags");
				return reply.code(500).send({ error: "Internal Server Error" });
			}
		});

		app.post<{
			Body: ModifyTagRequest;
			Reply: AdminApiReply<TagsJSON>;
		}>("/modify-tag", async (request, reply) => {
			request.log.info(
				{ client: clientDescription(request) },
				"[Tag Editing] started",
			);

			if (!isMatching(ModifyTagRequestPattern)(request.body)) {
				request.log.warn("[Tag Editing] rejected -- invalid request shape");
				return reply.code(400).send({ error: "Validation error" });
			}
			const { id } = request.body;
			try {
				const normalized = normalizeModifyTagRequest(request.body);
				const result = await database
					.transaction()
					.execute(async (transaction) => {
						const target = await transaction
							.selectFrom("tags")
							.select("id")
							.where("id", "=", id)
							.forUpdate()
							.executeTakeFirst();
						if (target === undefined) return { status: "missing" } as const;
						const duplicate = await match(normalized)
							.with({ edit_type: "review" }, () => false)
							.with(
								{ edit_type: "full_edit" },
								{ edit_type: "partial_edit" },
								async ({ values }) => {
									if (values.title === undefined) return false;
									const title = values.title;
									const others = await transaction
										.selectFrom("tags")
										.select("title")
										.where("id", "!=", id)
										.execute();
									return others.some(
										(tag) =>
											tag.title.trim().toLowerCase() === title.toLowerCase(),
									);
								},
							)
							.exhaustive();
						if (duplicate) return { status: "duplicate" } as const;
						const tag = await transaction
							.updateTable("tags")
							.set(normalized.values)
							.where("id", "=", id)
							.returningAll()
							.executeTakeFirstOrThrow();
						return { status: "saved", tag } as const;
					});
				if (result.status !== "saved") {
					const error =
						result.status === "missing"
							? "Not Found"
							: "Another tag already uses this title. Choose a different title.";
					request.log.warn(
						{ tagId: id },
						`[Tag Editing] rejected -- id: ${id}, reason: ${error}`,
					);
					return reply
						.code(result.status === "missing" ? 404 : 400)
						.send({ error });
				}
				const [modified] = transformTags({ tags: [result.tag] });
				if (modified === undefined)
					throw new Error("Tag transformation failed");
				request.log.info(
					{ tagId: id, client: clientDescription(request) },
					`[Tag Editing] Tag saved -- id: ${id}, edit_type: ${request.body.edit_type}`,
				);
				return reply.code(200).send(modified);
			} catch (error) {
				if (error instanceof TagEditValidationError) {
					request.log.warn(
						{ tagId: id },
						`[Tag Editing] rejected -- id: ${id}, reason: ${error.message}`,
					);
					return reply.code(400).send({ error: error.message });
				}
				request.log.error(
					{ err: error, tagId: id },
					`[Tag Editing] failed -- id: ${id}`,
				);
				return reply.code(500).send({ error: "Internal Server Error" });
			}
		});

		app.get<{ Params: { id: string }; Reply: AdminApiReply<TagDeleteImpact> }>(
			"/tags/:id/delete-impact",
			async (request, reply) => {
				request.log.info(
					{ client: clientDescription(request) },
					"[Tag Deletion Preview] started",
				);
				const rawId = request.params.id;
				const id = Number(rawId);
				if (
					!/^[0-9]+$/.test(rawId) ||
					!isMatching(RemoveTagRequestPattern, { id })
				) {
					request.log.warn("[Tag Deletion Preview] rejected -- invalid ID");
					return reply.code(400).send({ error: "Validation error" });
				}
				try {
					const impact = await loadTagDeleteImpact(database, id);
					if (impact === undefined) {
						request.log.warn(
							`[Tag Deletion Preview] rejected -- tag not found, id: ${id}`,
						);
						return reply.code(404).send({ error: "Not Found" });
					}
					request.log.info(
						`[Tag Deletion Preview] loaded -- id: ${id}, Shows: ${impact.shows.length}, DJs: ${impact.djs.length}`,
					);
					return impact;
				} catch (error) {
					request.log.error(
						{ err: error },
						`[Tag Deletion Preview] failed -- id: ${id}`,
					);
					return reply.code(500).send({ error: "Internal Server Error" });
				}
			},
		);
		app.post<{
			Body: RemoveTagRequest;
			Reply: AdminApiReply<RemoveTagResponse>;
		}>("/remove-tag", async (request, reply) => {
			request.log.info(
				{ client: clientDescription(request) },
				"[Tag Deletion] started",
			);
			if (!isMatching(RemoveTagRequestPattern, request.body)) {
				request.log.warn("[Tag Deletion] rejected -- invalid request shape");
				return reply.code(400).send({ error: "Validation error" });
			}
			const { id } = request.body;
			try {
				const removed = !isDatabaseId(id)
					? undefined
					: await database
							.deleteFrom("tags")
							.where("id", "=", id)
							.returning("id")
							.executeTakeFirst();
				if (removed === undefined) {
					request.log.warn(
						`[Tag Deletion] rejected -- tag not found, id: ${id}`,
					);
					return reply.code(404).send({ error: "Not Found" });
				}
				request.log.info(
					{ client: clientDescription(request) },
					`[Tag Deletion] deleted -- id: ${id}`,
				);
				return removed;
			} catch (error) {
				request.log.error({ err: error }, `[Tag Deletion] failed -- id: ${id}`);
				return reply.code(500).send({ error: "Internal Server Error" });
			}
		});
	};
