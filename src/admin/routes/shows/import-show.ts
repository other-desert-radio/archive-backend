import { sql, type Transaction } from "kysely";
import type { Database } from "../../../db/types.js";
import type { TypedDatabase } from "../types.js";
import type { NormalizedCreateShowRequest } from "./normalize-create-show-request.js";
import { loadSavedShow, saveShowInTransaction } from "./save-show.js";

/** Serializes imports of one tracking row and commits all writes together. */
export const importShow = async (
	database: TypedDatabase,
	normalized: NormalizedCreateShowRequest,
	importId: number,
) =>
	database
		.transaction()
		.execute((transaction) =>
			importShowInTransaction(transaction, normalized, importId),
		);

/** Caller owns commit/rollback; source-row locking is shared with uploaded saves. */
export const importShowInTransaction = async (
	transaction: Transaction<Database>,
	normalized: NormalizedCreateShowRequest,
	importId: number,
) => {
	const tracking = await transaction
		.selectFrom("mixcloud_import")
		.select("show_id")
		.where("id", "=", importId)
		.forUpdate()
		.executeTakeFirst();
	if (tracking === undefined) return undefined;
	if (tracking.show_id !== null) {
		return {
			created: false,
			show: await loadSavedShow(transaction, tracking.show_id),
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
};
