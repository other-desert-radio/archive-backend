import type { Kysely, Selectable } from "kysely";
import sharp from "sharp";
import type { Database, DJsTable } from "./types.js";

const DJ_IMAGE_WIDTHS = [400, 1024] as const;
const WEBP_QUALITY = 82;

export type DJWebPImageDerivatives = {
	image_1024_webp: Buffer;
	image_400_webp: Buffer;
};

type DJImageCacheRow = Pick<
	Selectable<DJsTable>,
	"id" | "image" | "image_1024_webp" | "image_400_webp"
>;

type GenerateDJWebPImageDerivatives = (
	image: Buffer,
) => Promise<DJWebPImageDerivatives>;

/** Generates the two public WebP widths directly from a stored source image. */
export const generateDJWebPImageDerivatives: GenerateDJWebPImageDerivatives =
	async (image) => {
		const [small, large] = await Promise.all([
			sharp(image)
				.rotate()
				.resize({ width: DJ_IMAGE_WIDTHS[0], withoutEnlargement: true })
				.webp({ quality: WEBP_QUALITY })
				.toBuffer(),
			sharp(image)
				.rotate()
				.resize({ width: DJ_IMAGE_WIDTHS[1], withoutEnlargement: true })
				.webp({ quality: WEBP_QUALITY })
				.toBuffer(),
		]);

		return {
			image_400_webp: small,
			image_1024_webp: large,
		};
	};

const cachedDerivativesFor = (
	dj: DJImageCacheRow,
): DJWebPImageDerivatives | undefined => {
	if (dj.image_1024_webp === null && dj.image_400_webp === null) {
		return undefined;
	}
	if (dj.image_1024_webp === null || dj.image_400_webp === null) {
		throw new Error(`DJ ${dj.id} has an incomplete WebP image cache`);
	}
	return {
		image_1024_webp: dj.image_1024_webp,
		image_400_webp: dj.image_400_webp,
	};
};

/**
 * Reads complete caches or creates both derivatives together under a row lock.
 * Source images are immutable in the current workflow, so a complete cache is
 * always reused instead of being regenerated.
 */
export const cacheDJWebPImageDerivatives = async (
	database: Kysely<Database>,
	djs: DJImageCacheRow[],
	generate: GenerateDJWebPImageDerivatives = generateDJWebPImageDerivatives,
): Promise<Map<number, DJWebPImageDerivatives>> => {
	const caches = new Map<number, DJWebPImageDerivatives>();

	for (const dj of djs) {
		const existingCache = cachedDerivativesFor(dj);
		if (existingCache !== undefined) {
			caches.set(dj.id, existingCache);
			continue;
		}
		if (dj.image === null) continue;

		const cache = await database.transaction().execute(async (transaction) => {
			const lockedDJ = await transaction
				.selectFrom("djs")
				.select(["id", "image", "image_1024_webp", "image_400_webp"])
				.where("id", "=", dj.id)
				.forUpdate()
				.executeTakeFirstOrThrow();
			const lockedCache = cachedDerivativesFor(lockedDJ);
			if (lockedCache !== undefined) return lockedCache;
			if (lockedDJ.image === null) {
				throw new Error(`DJ ${lockedDJ.id} has no source image`);
			}

			const generated = await generate(lockedDJ.image);
			await transaction
				.updateTable("djs")
				.set(generated)
				.where("id", "=", lockedDJ.id)
				.execute();
			return generated;
		});
		caches.set(dj.id, cache);
	}

	return caches;
};
