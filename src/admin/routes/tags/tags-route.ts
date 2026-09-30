import type { FastifyPluginAsync } from "fastify";
import { isMatching, P } from "ts-pattern";
import type { TagsJSON } from "../../../json-transformers/index.js";
import { transformTags } from "../../../json-transformers/index.js";
import { undefinedOrEmpty } from "../../../utils/index.js";
import {
	type ValidateTagsResult,
	validateTags,
} from "../../../utils/validate-tags.js";
import { clientDescription } from "../../logging.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";
import { type CreatedTag, createTag, createTags } from "./tag-service.js";
import {
	type CreateTagRequest,
	CreateTagRequestPattern,
	type CreateTagsRequest,
	CreateTagsRequestPattern,
	type ModifyTagRequest,
	ModifyTagRequestPattern,
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
			Body: { tags: string[] };
			Reply: AdminApiReply<ValidateTagsResult>;
		}>("/validate-tags", async (request, reply) => {
			try {
				if (!isMatching({ tags: P.array(P.string) }, request.body)) {
					return reply.code(400).send({
						error: "invalid request body, expected array of strings",
					});
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
				request.log.error(error, "Unable to validate tags");
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
			if (!isMatching(ModifyTagRequestPattern, request.body)) {
				request.log.warn("[Tag Editing] rejected -- invalid request shape");
				return reply.code(400).send({ error: "Validation error" });
			}
			const { id } = request.body;
			const title = request.body.title.trim();
			const color = request.body.color.trim();
			const key = request.body.mixcloud_key?.trim();
			const url = request.body.mixcloud_url?.trim();
			let reason: string | undefined;
			if (!isMatching({ title: P.string.minLength(1) }, { title }))
				reason = "Tag title is required";
			else if (!isMatching(P.string.regex(/^#[0-9a-fA-F]{6}$/), color))
				reason = "Color must be a six-digit hex color (#RRGGBB)";
			else if (!undefinedOrEmpty(url)) {
				try {
					const parsed = new URL(url);
					if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
						reason = "Mixcloud URL must be an absolute HTTP(S) URL";
				} catch {
					reason = "Mixcloud URL must be an absolute HTTP(S) URL";
				}
			}
			if (reason !== undefined) {
				request.log.warn(
					{ tagId: id },
					`[Tag Editing] rejected -- id: ${id}, reason: ${reason}`,
				);
				return reply.code(400).send({ error: reason });
			}
			try {
				const result = await database
					.transaction()
					.execute(async (transaction) => {
						// Tags use PostgreSQL integer IDs; larger safe integers cannot exist.
						if (id > 2_147_483_647) return { status: "missing" } as const;
						const target = await transaction
							.selectFrom("tags")
							.select("id")
							.where("id", "=", id)
							.forUpdate()
							.executeTakeFirst();
						if (target === undefined) return { status: "missing" } as const;
						const others = await transaction
							.selectFrom("tags")
							.select("title")
							.where("id", "!=", id)
							.execute();
						if (
							others.some(
								(tag) => tag.title.trim().toLowerCase() === title.toLowerCase(),
							)
						)
							return { status: "duplicate" } as const;
						const tag = await transaction
							.updateTable("tags")
							.set({
								title,
								color,
								reviewed: true,
								mixcloud_key: undefinedOrEmpty(key) ? null : key,
								mixcloud_url: undefinedOrEmpty(url) ? null : url,
							})
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
					`[Tag Editing] Tag saved -- id: ${id}`,
				);
				return reply.code(200).send(modified);
			} catch (error) {
				request.log.error(
					{ err: error, tagId: id },
					`[Tag Editing] failed -- id: ${id}`,
				);
				return reply.code(500).send({ error: "Internal Server Error" });
			}
		});

		app.post("/remove-tag", async () => {
			// soft delete
			return undefined;
		});
	};
