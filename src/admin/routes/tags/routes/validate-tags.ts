import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { validateTags } from "../../../../utils/validate-tags.js";
import type { TypedDatabase } from "../../types.js";
import { resolveMixcloudTags } from "../resolve-mixcloud-tags.js";
import type { ValidateTagsRoute } from "../types.js";
import { ValidateTagsRequestPattern } from "../types.js";

export const validateTagsHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ValidateTagsRoute>,
		reply: FastifyReply<ValidateTagsRoute>,
	) => {
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
	};
