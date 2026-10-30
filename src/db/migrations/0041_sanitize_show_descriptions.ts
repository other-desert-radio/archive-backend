/* shows.description: convert existing plain text to the DJ bio HTML format. */
import type { Kysely } from "kysely";
import { plainTextToSafeHtml } from "../../utils/plain-text-to-safe-html.js";
import { safeHtmlToPlainText } from "../../utils/safe-html-to-plain-text.js";
import type { Database } from "../types.js";

async function convert(
	db: Kysely<Database>,
	transform: (text: string) => string,
): Promise<void> {
	const shows = await db
		.selectFrom("shows")
		.select(["id", "description"])
		.where("description", "is not", null)
		.execute();
	for (const show of shows) {
		if (show.description === null || show.description === "") continue;
		await db
			.updateTable("shows")
			.set({ description: transform(show.description) })
			.where("id", "=", show.id)
			.execute();
	}
}
export async function up(db: Kysely<Database>): Promise<void> {
	await convert(db, plainTextToSafeHtml);
}
export async function down(db: Kysely<Database>): Promise<void> {
	await convert(db, safeHtmlToPlainText);
}
