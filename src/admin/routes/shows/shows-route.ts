import type { FastifyPluginAsync } from "fastify";
import { isMatching } from "ts-pattern";
import { transformShows } from "../../../json-transformers/index.js";
import { clientDescription } from "../../logging.js";
import { createTags } from "../tags/tag-service.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";
import { normalizeCreateShowRequest } from "./normalize-create-show-request.js";
import {
	type AdminShowsJSON,
	type CreateShowRequest,
	CreateShowRequestPattern,
} from "./types.js";

/** Registers authenticated Shows API routes. */
export const showRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.get<{ Reply: AdminApiReply<AdminShowsJSON[]> }>(
			"/shows",
			async (request, reply) => {
				try {
					const [shows, showDJs, showTags] = await Promise.all([
						database
							.selectFrom("shows")
							.select([
								"id",
								"createdAt",
								"title",
								"date",
								"duration",
								"image",
								"url",
							])
							.orderBy("id")
							.execute(),
						database
							.selectFrom("show_djs")
							.select(["show_id", "dj_id"])
							.orderBy("show_id")
							.orderBy("dj_id")
							.execute(),
						database
							.selectFrom("show_tags")
							.select(["show_id", "tag_id"])
							.orderBy("show_id")
							.orderBy("tag_id")
							.execute(),
					]);

					const createdAtByShowId = new Map(
						shows.map((show) => [show.id, show.createdAt]),
					);
					return transformShows({ shows, showDJs, showTags }).map((show) => {
						const createdAt = createdAtByShowId.get(show.id);
						if (createdAt === undefined) {
							throw new Error(
								`Show ${show.id} is missing its creation timestamp`,
							);
						}
						return { ...show, createdAt };
					});
				} catch (error) {
					request.log.error(error, "Unable to load shows");
					return reply.code(500).send({ error: "Internal Server Error" });
				}
			},
		);

		app.post<{
			Body: CreateShowRequest;
			Reply: AdminApiReply<AdminShowsJSON>;
		}>("/create-show", async (request, reply) => {
			request.log.info(
				{ client: clientDescription(request) },
				"[Show Creation] started",
			);
			if (!isMatching(CreateShowRequestPattern, request.body)) {
				request.log.warn("[Show Creation] rejected -- invalid request shape");
				return reply.code(400).send({ error: "Validation error" });
			}
			try {
				const normalized = normalizeCreateShowRequest(request.body);
				const created = await database
					.transaction()
					.execute(async (transaction) => {
						const existingDJs = await transaction
							.selectFrom("djs")
							.select("id")
							.where("id", "in", normalized.djs)
							.execute();
						if (existingDJs.length !== normalized.djs.length) {
							throw new Error("One or more selected DJs do not exist");
						}
						const createdTags = await createTags(
							transaction,
							normalized.tags.map((title) => ({ title })),
						);
						const show = await transaction
							.insertInto("shows")
							.values({
								title: normalized.title,
								date: normalized.date,
								duration: normalized.duration,
								image: normalized.image,
								url: normalized.url,
							})
							.returning(["id", "createdAt"])
							.executeTakeFirstOrThrow();
						await transaction
							.insertInto("show_djs")
							.values(
								normalized.djs.map((djId) => ({
									show_id: show.id,
									dj_id: djId,
								})),
							)
							.execute();
						if (createdTags.length > 0) {
							await transaction
								.insertInto("show_tags")
								.values(
									createdTags.map((tag) => ({
										show_id: show.id,
										tag_id: tag.id,
									})),
								)
								.execute();
						}
						return {
							id: show.id,
							createdAt: show.createdAt,
							title: normalized.title,
							date: normalized.date,
							duration: normalized.duration,
							...(normalized.image === null ? {} : { image: normalized.image }),
							url: normalized.url,
							djs: [...normalized.djs].sort((a, b) => a - b),
							tags: createdTags.map((tag) => tag.id).sort((a, b) => a - b),
						};
					});
				request.log.info(
					{ showId: created.id, client: clientDescription(request) },
					`[Show Creation] Show created -- id: ${created.id}, title: ${created.title}`,
				);
				return reply.code(201).send(created);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Internal Server Error";
				if (
					message === "Validation error" ||
					message === "One or more selected DJs do not exist"
				) {
					request.log.warn({ reason: message }, "[Show Creation] rejected");
					return reply.code(400).send({ error: message });
				}
				request.log.error({ err: error }, "[Show Creation] failed");
				return reply.code(500).send({ error: "Internal Server Error" });
			}
		});

		app.post("/modify-show", async () => {
			return undefined;
		});

		app.post("/remove-show", async () => {
			// soft delete
			return undefined;
		});
	};
