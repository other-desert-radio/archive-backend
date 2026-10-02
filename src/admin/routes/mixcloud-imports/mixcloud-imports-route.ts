import type { FastifyPluginAsync } from "fastify";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import type { AdminApiReply, TypedDatabase } from "../types.js";
import { fetchMixcloud } from "./fetch-mixcloud.js";
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
				request.log.info(
					"[Mixcloud Refresh] started -- /api/admin/refresh-mixcloud",
				);
				try {
					const source = await fetchMixcloud();
					request.log.info(
						{ count: source.data.length },
						`[Mixcloud Refresh] completed -- fetched ${source.data.length} cloudcasts into memory`,
					);
					return { status: "ok" };
				} catch (error) {
					request.log.error(
						{ err: error },
						"[Mixcloud Refresh] failed -- /api/admin/refresh-mixcloud",
					);
					return reply.code(500).send({ error: "Internal Server Error" });
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
							"mixcloud_import.key",
							"mixcloud_import.show_id",
							"mixcloud_import.imported_at",
							"shows.title as show_name",
							"mixcloud_import.duration",
							"mixcloud_import.url",
							"mixcloud_import.name",
							"mixcloud_import.created_time",
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
						key: row.key,
						...(row.url === null ? {} : { url: row.url }),
						...(row.name === null ? {} : { name: row.name }),
						...(row.created_time === null
							? {}
							: { created_time: row.created_time.toISOString() }),
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
