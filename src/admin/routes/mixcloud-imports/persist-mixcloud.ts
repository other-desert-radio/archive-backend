import { sql } from "kysely";
import {
	MIXCLOUD_PARSER_VERSION,
	type MixcloudParserResult,
	parseMixcloudEntry,
} from "../../../utils/index.js";
import type { TypedDatabase } from "../types.js";
import type { MixcloudCloudcast, MixcloudCloudcasts } from "./types.js";

/** Persist one validated cloudcast using the caller's database or transaction. */
export const persistMixcloudEntry = async (
	database: TypedDatabase,
	entry: MixcloudCloudcast,
	parserResults?: ReadonlyMap<string, MixcloudParserResult | undefined>,
): Promise<void> => {
	const parsed = parserResults
		? parserResults.get(entry.key)
		: parseMixcloudEntry(entry);
	const suggestions =
		parsed === undefined
			? {
					derived_title: null,
					derived_date: null,
					decoded_djs: null,
					parser_version: MIXCLOUD_PARSER_VERSION,
					parser_key: null,
					date_source: null,
				}
			: {
					derived_title: parsed.derived_title,
					derived_date: parsed.derived_date,
					decoded_djs: parsed.decoded_djs,
					parser_version: parsed.parser_version,
					parser_key: parsed.parser_key,
					date_source: parsed.date_source,
				};
	await database
		.insertInto("mixcloud_import")
		.values({
			...suggestions,
			key: entry.key,
			url: entry.url,
			name: entry.name,
			created_time: new Date(entry.created_time),
			duration: entry.audio_length,
			image_small: entry.pictures.large,
			image_large: entry.pictures["1024wx1024h"],
			mixcloud_tag_keys: [...new Set(entry.tags.map((tag) => tag.key))].sort(),
		})
		.onConflict((conflict) =>
			conflict.column("key").doUpdateSet((eb) => ({
				derived_title: eb.ref("excluded.derived_title"),
				derived_date: eb.ref("excluded.derived_date"),
				decoded_djs: eb.ref("excluded.decoded_djs"),
				parser_version: eb.ref("excluded.parser_version"),
				parser_key: eb.ref("excluded.parser_key"),
				date_source: eb.ref("excluded.date_source"),
				url: eb.ref("excluded.url"),
				name: eb.ref("excluded.name"),
				created_time: eb.ref("excluded.created_time"),
				duration: eb.ref("excluded.duration"),
				image_small: eb.ref("excluded.image_small"),
				image_large: eb.ref("excluded.image_large"),
				mixcloud_tag_keys: eb.ref("excluded.mixcloud_tag_keys"),
				// Compare against the current row atomically; never clear a pending review.
				data_changed: sql<boolean>`mixcloud_import.data_changed OR (
					mixcloud_import.show_id IS NOT NULL AND (
						ROW(mixcloud_import.url, mixcloud_import.name,
							mixcloud_import.created_time, mixcloud_import.duration,
							mixcloud_import.image_small, mixcloud_import.image_large)
						IS DISTINCT FROM
						ROW(excluded.url, excluded.name, excluded.created_time,
							excluded.duration, excluded.image_small, excluded.image_large)
						OR ARRAY(SELECT DISTINCT tag_key FROM unnest(mixcloud_import.mixcloud_tag_keys) AS tag_key ORDER BY tag_key)
							IS DISTINCT FROM excluded.mixcloud_tag_keys
						OR mixcloud_import.mixcloud_tag_keys IS NULL
					)
				)`,
			})),
		)
		.execute();
};

/** Atomically refresh source metadata without modifying approved archive records. */
export const persistMixcloud = async (
	database: TypedDatabase,
	source: MixcloudCloudcasts,
	logger?: FastifyBaseLogger,
	parserResults?: ReadonlyMap<string, MixcloudParserResult | undefined>,
): Promise<void> => {
	if (source.data.length === 0) return;
	await database.transaction().execute(async (transaction) => {
		let processed = 0;
		for (const entry of source.data) {
			try {
				await persistMixcloudEntry(transaction, entry, parserResults);
			} catch (error) {
				logger?.error(
					{ err: error, key: entry.key, processed, total: source.data.length },
					`[Mixcloud Refresh] record save failed -- key: ${entry.key}, processed: ${processed}/${source.data.length}; rolling back refresh`,
				);
				throw error;
			}
			processed++;
			if (processed % 100 === 0 || processed === source.data.length)
				logger?.info(
					{ processed, total: source.data.length },
					`[Mixcloud Refresh] saving progress -- ${processed}/${source.data.length} records (transaction not yet committed)`,
				);
		}
	});
};

import type { FastifyBaseLogger } from "fastify";
