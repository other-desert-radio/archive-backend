import type { FastifyReply, FastifyRequest } from "fastify";
import {
	MIXCLOUD_PARSER_VERSION,
	parseMixcloudEntry,
} from "../../../../utils/index.js";
import type { TypedDatabase } from "../../types.js";
import { fetchMixcloud } from "../fetch-mixcloud.js";
import { persistMixcloud } from "../persist-mixcloud.js";
import type { RefreshMixcloudRoute } from "../types.js";

export const refreshMixcloudHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<RefreshMixcloudRoute>,
		reply: FastifyReply<RefreshMixcloudRoute>,
	) => {
		const startedAt = Date.now();
		let stage: "fetch" | "save" = "fetch";
		request.log.info(
			"[Mixcloud Refresh] started -- /api/admin/refresh-mixcloud",
		);
		try {
			const source = await fetchMixcloud(fetch, request.log);
			stage = "save";

			const parserResults = new Map(
				source.data.map((entry) => [entry.key, parseMixcloudEntry(entry)]),
			);
			const matched = [...parserResults.values()].filter(
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

			await persistMixcloud(database, source, request.log, parserResults);

			request.log.info(
				{ count: source.data.length, elapsedMs: Date.now() - startedAt },
				`[Mixcloud Refresh] completed -- committed ${source.data.length} cloudcasts, elapsed: ${Date.now() - startedAt}ms`,
			);
			return { status: "ok" } as const;
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
	};
