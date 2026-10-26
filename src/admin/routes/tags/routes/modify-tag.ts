import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, match } from "ts-pattern";
import { transformTags } from "../../../../json-transformers/index.js";
import { clientDescription } from "../../../logging.js";
import type { TypedDatabase } from "../../types.js";
import {
	normalizeModifyTagRequest,
	TagEditValidationError,
} from "../normalize-modify-tag-request.js";
import type { ModifyTagRoute } from "../types.js";
import { ModifyTagRequestPattern } from "../types.js";

export const modifyTagHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ModifyTagRoute>,
		reply: FastifyReply<ModifyTagRoute>,
	) => {
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
						.executeTakeFirst();
					if (tag === undefined) return { status: "missing" } as const;
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
			if (modified === undefined) throw new Error("Tag transformation failed");
			request.log.info(
				{ tagId: id, client: clientDescription(request) },
				`[Tag Editing] Tag saved -- id: ${id}, edit_type: ${request.body.edit_type}`,
			);
			return reply.code(200).send(modified);
		} catch (error) {
			if (
				error instanceof TagEditValidationError ||
				isMatching(
					{ code: "23505", constraint: "tags_normalized_title_unique" },
					error,
				)
			) {
				const message =
					error instanceof TagEditValidationError
						? error.message
						: "Another tag already uses this title. Choose a different title.";
				request.log.warn(
					{ tagId: id },
					`[Tag Editing] rejected -- id: ${id}, reason: ${message}`,
				);
				return reply.code(400).send({ error: message });
			}
			request.log.error(
				{ err: error, tagId: id },
				`[Tag Editing] failed -- id: ${id}`,
			);
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
