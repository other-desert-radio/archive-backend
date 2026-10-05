import type { FastifyPluginAsync } from "fastify";
import { isMatching } from "ts-pattern";
import { transformShows } from "../../../json-transformers/index.js";
import { clientDescription } from "../../logging.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";
import { normalizeCreateShowRequest } from "./normalize-create-show-request.js";
import { saveShow } from "./save-show.js";
import {
	type AdminShowsJSON,
	type CreateShowRequest,
	CreateShowRequestPattern,
	type ModifyShowRequest,
	ModifyShowRequestPattern,
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
								"image_small",
								"image_large",
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

					const rowsByShowId = new Map(shows.map((show) => [show.id, show]));
					return transformShows({ shows, showDJs, showTags }).map((show) => {
						const row = rowsByShowId.get(show.id);
						if (row === undefined) {
							throw new Error(
								`Show ${show.id} is missing its creation timestamp`,
							);
						}
						return {
							...show,
							createdAt: row.createdAt,
							image_small: row.image_small,
							image_large: row.image_large,
						};
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
				const created = await saveShow(database, normalized);
				if (created === undefined) throw new Error("Show creation failed");
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

		app.post<{
			Body: ModifyShowRequest;
			Reply: AdminApiReply<AdminShowsJSON>;
		}>("/modify-show", async (request, reply) => {
			request.log.info(
				{ client: clientDescription(request) },
				"[Show Editing] started",
			);
			if (!isMatching(ModifyShowRequestPattern, request.body)) {
				request.log.warn("[Show Editing] rejected -- invalid request shape");
				return reply.code(400).send({ error: "Validation error" });
			}
			const id = request.body.id;
			try {
				const normalized = normalizeCreateShowRequest(request.body);
				const modified = await saveShow(database, normalized, id);
				if (modified === undefined) {
					request.log.warn(
						{ showId: id },
						`[Show Editing] rejected -- Show ${id} not found`,
					);
					return reply.code(404).send({ error: "Not Found" });
				}
				request.log.info(
					{ showId: id, client: clientDescription(request) },
					`[Show Editing] Show saved -- id: ${id}, title: ${modified.title}`,
				);
				return reply.code(200).send(modified);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Internal Server Error";
				if (
					message === "Validation error" ||
					message === "One or more selected DJs do not exist"
				) {
					request.log.warn(
						{ showId: id, reason: message },
						`[Show Editing] rejected -- id: ${id}, reason: ${message}`,
					);
					return reply.code(400).send({ error: message });
				}
				request.log.error(
					{ err: error, showId: id },
					`[Show Editing] failed -- id: ${id}`,
				);
				return reply.code(500).send({ error: "Internal Server Error" });
			}
		});
	};
