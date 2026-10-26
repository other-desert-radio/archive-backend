import type { FastifyReply, FastifyRequest } from "fastify";
import { classifyMixcloudImport } from "../../../../utils/index.js";
import type { TypedDatabase } from "../../types.js";
import { decodedDjsExist, missingDjs } from "../dj-match-expressions.js";
import type {
	GetMixcloudImportStatusRoute,
	MixcloudImportStatus,
} from "../types.js";

export const getMixcloudImportStatusHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<GetMixcloudImportStatusRoute>,
		reply: FastifyReply<GetMixcloudImportStatusRoute>,
	) => {
		request.log.info(
			"[Mixcloud Status] loading -- /api/admin/mixcloud-import/status",
		);
		try {
			const rows = await database
				.selectFrom("mixcloud_import")
				.select([
					"show_id",
					"derived_title",
					"derived_date",
					"decoded_djs",
					"parser_version",
					"parser_key",
					"date_source",
				])
				.select(decodedDjsExist)
				.select(missingDjs)
				.where("show_id", "is", null)
				.orderBy("mixcloud_import.id")
				.execute();
			const status: MixcloudImportStatus = {
				auto_parsed: 0,
				unparsable: 0,
				missing_djs: [],
			};
			const names = new Map<string, string>();
			for (const row of rows) {
				const category = classifyMixcloudImport(row);
				if (category === undefined) continue;
				status[category]++;
				for (const name of row.missing_djs) {
					const trimmed = name.trim();
					const key = trimmed.toLowerCase();
					if (key && !names.has(key)) names.set(key, trimmed);
				}
			}
			status.missing_djs = [...names.values()].sort((a, b) =>
				a.localeCompare(b),
			);
			request.log.info(
				status,
				`[Mixcloud Status] loaded -- ${status.auto_parsed} ready, ${status.unparsable} need review`,
			);
			return status;
		} catch (error) {
			request.log.error(
				{ err: error },
				"[Mixcloud Status] failed -- /api/admin/mixcloud-import/status",
			);
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
