import type { FastifyPluginAsync } from "fastify";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import {
	MIXCLOUD_PARSER_VERSION,
	parseMixcloudEntry,
} from "../../../utils/index.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";
import { fetchMixcloud } from "./fetch-mixcloud.js";
import { persistMixcloud } from "./persist-mixcloud.js";
import type {
	MixcloudImportAdminRow,
	RefreshMixcloudResponse,
} from "./types.js";

/** Registers authenticated Mixcloud import list and refresh API routes. */
export const mixcloudImportRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.post<{ Reply: AdminApiReply<RefreshMixcloudResponse> }>(
			"/refresh-mixcloud",
			async (request, reply) => {
				const startedAt = Date.now();
				let stage: "fetch" | "save" = "fetch";
				request.log.info(
					"[Mixcloud Refresh] started -- /api/admin/refresh-mixcloud",
				);
				try {
					const source = await fetchMixcloud(fetch, request.log);
					stage = "save";

					const parserResults = source.data.map(parseMixcloudEntry);
					const matched = parserResults.filter(
						(result) => result !== undefined,
					).length;

					request.log.info(
						{
							count: source.data.length,
							matched,
							unmatched: source.data.length - matched,
							parserVersion: MIXCLOUD_PARSER_VERSION,
						},
						`[Mixcloud Refresh] parsing completed -- ${matched}/${source.data.length} matched, ${source.data.length - matched} unmatched or excluded, parser version: ${MIXCLOUD_PARSER_VERSION}`,
					);

					request.log.info(
						{ count: source.data.length },
						`[Mixcloud Refresh] saving started -- ${source.data.length} cloudcasts in one transaction`,
					);

					await persistMixcloud(database, source, request.log);

					request.log.info(
						{ count: source.data.length, elapsedMs: Date.now() - startedAt },
						`[Mixcloud Refresh] completed -- committed ${source.data.length} cloudcasts, elapsed: ${Date.now() - startedAt}ms`,
					);
					return { status: "ok" };
				} catch (error) {
					request.log.error(
						{ err: error, stage, elapsedMs: Date.now() - startedAt },
						`[Mixcloud Refresh] failed -- stage: ${stage}, elapsed: ${Date.now() - startedAt}ms, /api/admin/refresh-mixcloud`,
					);
					return reply.code(500).send({
						error:
							stage === "fetch"
								? "Mixcloud data could not be fetched or validated. No changes were saved. Please try again; if this continues, contact the administrator."
								: "Mixcloud data was fetched, but could not be saved. No changes were saved. Please contact the administrator.",
					});
				}
			},
		);
		app.get<{ Reply: AdminApiReply<MixcloudImportAdminRow[]> }>(
			"/mixcloud-imports",
			async (request, reply) => {
				request.log.info(
					"[Mixcloud Imports] loading -- /api/admin/mixcloud-imports",
				);
				try {
					const rows = await database
						.selectFrom("mixcloud_import")
						.leftJoin("shows", "shows.id", "mixcloud_import.show_id")
						.select([
							"mixcloud_import.id",
							"mixcloud_import.data_changed",
							"mixcloud_import.key",
							"mixcloud_import.show_id",
							"mixcloud_import.imported_at",
							"shows.title as show_name",
							"mixcloud_import.duration",
							"mixcloud_import.mixcloud_tag_keys",
							"mixcloud_import.url",
							"mixcloud_import.name",
							"mixcloud_import.created_time",
							"mixcloud_import.derived_title",
							"mixcloud_import.derived_date",
							"mixcloud_import.decoded_djs",
							"mixcloud_import.parser_version",
							"mixcloud_import.parser_key",
							"mixcloud_import.date_source",
							"mixcloud_import.image_small",
							"mixcloud_import.image_large",
						])
						.select((eb) => [
							jsonArrayFrom(
								eb
									.selectFrom("show_djs")
									.innerJoin("djs", "djs.id", "show_djs.dj_id")
									.select(["djs.id", "djs.title"])
									.whereRef("show_djs.show_id", "=", "mixcloud_import.show_id")
									.distinct()
									.orderBy("djs.id"),
							).as("linked_djs"),
							jsonArrayFrom(
								eb
									.selectFrom("show_tags")
									.select("tag_id")
									.whereRef("show_tags.show_id", "=", "mixcloud_import.show_id")
									.distinct()
									.orderBy("tag_id"),
							).as("linked_tags"),
						])
						.orderBy("mixcloud_import.id")
						.execute();
					const result: MixcloudImportAdminRow[] = rows.map((row) => ({
						id: row.id,
						data_changed: row.data_changed,
						...(row.mixcloud_tag_keys === null
							? {}
							: { mixcloud_tag_keys: row.mixcloud_tag_keys }),
						key: row.key,
						...(row.url === null ? {} : { url: row.url }),
						...(row.name === null ? {} : { name: row.name }),
						...(row.created_time === null
							? {}
							: { created_time: row.created_time.toISOString() }),
						...(row.derived_title === null
							? {}
							: { derived_title: row.derived_title }),
						...(row.derived_date === null
							? {}
							: { derived_date: row.derived_date.toISOString() }),
						...(row.decoded_djs === null
							? {}
							: { decoded_djs: row.decoded_djs }),
						...(row.parser_version === null
							? {}
							: { parser_version: row.parser_version }),
						...(row.parser_key === null ? {} : { parser_key: row.parser_key }),
						...(row.date_source === null
							? {}
							: { date_source: row.date_source }),
						...(row.image_small === null
							? {}
							: { image_small: row.image_small }),
						...(row.image_large === null
							? {}
							: { image_large: row.image_large }),
						...(row.show_id === null ? {} : { show_id: row.show_id }),
						...(row.imported_at === null
							? {}
							: { imported_at: row.imported_at.toISOString() }),
						...(row.show_name === null ? {} : { show_name: row.show_name }),
						...(row.duration === null ? {} : { duration: row.duration }),
						djs: row.linked_djs.map((dj) => dj.id),
						dj_names: row.linked_djs.map((dj) => dj.title),
						tags: row.linked_tags.map((tag) => tag.tag_id),
					}));
					request.log.info(
						{ count: result.length },
						`[Mixcloud Imports] loaded -- ${result.length} records`,
					);
					return result;
				} catch (error) {
					request.log.error(
						{ err: error },
						"[Mixcloud Imports] failed -- /api/admin/mixcloud-imports",
					);
					return reply.code(500).send({ error: "Internal Server Error" });
				}
			},
		);
	};
