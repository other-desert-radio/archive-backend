import { sql } from "kysely";
import type { TypedDatabase } from "../types.js";
import type { NormalizedCreateShowRequest } from "./normalize-create-show-request.js";
import { saveShowInTransaction } from "./save-show.js";

/** Serializes imports of one tracking row and commits all writes together. */
export const importShow = async (
	database: TypedDatabase,
	normalized: NormalizedCreateShowRequest,
	importId: number,
) =>
	database.transaction().execute(async (transaction) => {
		const tracking = await transaction
			.selectFrom("mixcloud_import")
			.select("show_id")
			.where("id", "=", importId)
			.forUpdate()
			.executeTakeFirst();
		if (tracking === undefined) return undefined;
		if (tracking.show_id !== null) {
			const show = await transaction
				.selectFrom("shows")
				.selectAll()
				.where("id", "=", tracking.show_id)
				.executeTakeFirstOrThrow();
			const djs = await transaction
				.selectFrom("show_djs")
				.select("dj_id")
				.where("show_id", "=", show.id)
				.orderBy("dj_id")
				.execute();
			const tags = await transaction
				.selectFrom("show_tags")
				.select("tag_id")
				.where("show_id", "=", show.id)
				.orderBy("tag_id")
				.execute();
			return {
				created: false,
				show: {
					...show,
					image: show.image_large,
					djs: djs.map(({ dj_id }) => dj_id),
					tags: tags.map(({ tag_id }) => tag_id),
				},
			};
		}
		const show = await saveShowInTransaction(transaction, normalized);
		if (show === undefined) throw new Error("Show creation failed");
		await transaction
			.updateTable("mixcloud_import")
			.set({
				show_id: show.id,
				imported_at: sql`CURRENT_TIMESTAMP`,
				data_changed: false,
			})
			.where("id", "=", importId)
			.executeTakeFirstOrThrow();
		return { created: true, show };
	});
