import { sql } from "kysely";
import type { TypedDatabase } from "../types.js";
import type { MixcloudCloudcast, MixcloudCloudcasts } from "./types.js";

/** Persist one validated cloudcast using the caller's database or transaction. */
export const persistMixcloudEntry = async (
	database: TypedDatabase,
	entry: MixcloudCloudcast,
): Promise<void> => {
	await database
		.insertInto("mixcloud_import")
		.values({
			key: entry.key,
			url: entry.url,
			name: entry.name,
			created_time: new Date(entry.created_time),
			duration: entry.audio_length,
			image_small: entry.pictures.small,
			image_large: entry.pictures.large,
			mixcloud_tag_keys: [...new Set(entry.tags.map((tag) => tag.key))].sort(),
		})
		.onConflict((conflict) =>
			conflict.column("key").doUpdateSet((eb) => ({
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
): Promise<void> => {
	if (source.data.length === 0) return;
	await database.transaction().execute(async (transaction) => {
		for (const entry of source.data) {
			await persistMixcloudEntry(transaction, entry);
		}
	});
};
