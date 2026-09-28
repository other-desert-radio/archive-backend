import { type Kysely, sql } from "kysely";
import { generateSquareWebPImages } from "../../utils/images/index.js";
import type { Database } from "../types.js";

/** Adds and backfills the two public WebP image variants for existing DJs. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("djs")
		.addColumn("image_small", "bytea")
		.addColumn("image_large", "bytea")
		.execute();

	const djs = await db
		.selectFrom("djs")
		.select(["id", "image"])
		.where("image", "is not", null)
		.orderBy("id")
		.execute();

	for (const dj of djs) {
		if (dj.image === null) continue;
		const images = await generateSquareWebPImages(dj.image);
		await db
			.updateTable("djs")
			.set({ image_small: images.small, image_large: images.large })
			.where("id", "=", dj.id)
			.execute();
	}

	await sql`
		ALTER TABLE djs
		ADD CONSTRAINT djs_webp_image_pair
		CHECK ((image_small IS NULL) = (image_large IS NULL))
	`.execute(db);
}

/** Removes the derivative columns while retaining the original stored uploads. */
export async function down(db: Kysely<Database>): Promise<void> {
	await sql`ALTER TABLE djs DROP CONSTRAINT djs_webp_image_pair`.execute(db);
	await db.schema
		.alterTable("djs")
		.dropColumn("image_large")
		.dropColumn("image_small")
		.execute();
}
