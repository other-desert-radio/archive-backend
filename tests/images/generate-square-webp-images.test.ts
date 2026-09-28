import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import {
	generateSquareWebPImages,
	LARGE_IMAGE_SIZE,
	SMALL_IMAGE_SIZE,
} from "../../src/utils/images/index.js";

const sourceImage = (width: number, height: number) =>
	sharp({
		create: {
			width,
			height,
			channels: 3,
			background: { r: 40, g: 50, b: 60 },
		},
	})
		.jpeg()
		.toBuffer();

describe("square WebP images", () => {
	test("creates exact 400px and 1024px square WebP crops", async () => {
		const variants = await generateSquareWebPImages(
			await sourceImage(1600, 800),
		);
		const [small, large] = await Promise.all([
			sharp(variants.small).metadata(),
			sharp(variants.large).metadata(),
		]);

		expect(small).toMatchObject({
			format: "webp",
			width: SMALL_IMAGE_SIZE,
			height: SMALL_IMAGE_SIZE,
		});
		expect(large).toMatchObject({
			format: "webp",
			width: LARGE_IMAGE_SIZE,
			height: LARGE_IMAGE_SIZE,
		});
	});

	test("enlarges smaller images to both exact target sizes", async () => {
		const variants = await generateSquareWebPImages(
			await sourceImage(100, 100),
		);

		expect(await sharp(variants.small).metadata()).toMatchObject({
			width: SMALL_IMAGE_SIZE,
			height: SMALL_IMAGE_SIZE,
		});
		expect(await sharp(variants.large).metadata()).toMatchObject({
			width: LARGE_IMAGE_SIZE,
			height: LARGE_IMAGE_SIZE,
		});
	});

	test("rejects image bytes Sharp cannot decode", async () => {
		await expect(
			generateSquareWebPImages(Buffer.from("not an image")),
		).rejects.toThrow();
	});
});
