import type { FastifyPluginAsync } from "fastify";
import { isMatching, P } from "ts-pattern";
import type { TagsJSON } from "../../../json-transformers/index.js";
import { transformTags } from "../../../json-transformers/index.js";
import {
	type ValidateTagsResult,
	validateTags,
} from "../../../utils/validate-tags.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";
import { type CreatedTag, createTag, createTags } from "./tag-service.js";
import {
	type CreateTagRequest,
	CreateTagRequestPattern,
	type CreateTagsRequest,
	CreateTagsRequestPattern,
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

		app.post("/modify-tag", async () => {
			// TODO: set reviewed column to true
			return undefined;
		});

		app.post("/remove-tag", async () => {
			// soft delete
			return undefined;
		});
	};
