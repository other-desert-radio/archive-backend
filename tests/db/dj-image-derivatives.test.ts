import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import {
	cacheDJWebPImageDerivatives,
	generateDJWebPImageDerivatives,
} from "../../src/db/dj-image-derivatives.js";

const createDatabase = (row: {
	id: number;
	image: Buffer | null;
	image_1024_webp: Buffer | null;
	image_400_webp: Buffer | null;
}) => {
	const database = {
		transaction: () => ({
			execute: async (callback: (transaction: never) => Promise<unknown>) =>
				callback({
					selectFrom: () => ({
						select: () => ({
							where: () => ({
								forUpdate: () => ({
									executeTakeFirstOrThrow: async () => row,
								}),
							}),
						}),
					}),
					updateTable: () => {
						const builder = {
							set: (values: Partial<typeof row>) => {
								Object.assign(row, values);
								return builder;
							},
							where: () => builder,
							execute: async () => undefined,
						};
						return builder;
					},
				} as never),
		}),
	} as never;

	return { database, row };
};

describe("DJ WebP image derivatives", () => {
	test("creates 400px and 1024px WebP files without changing aspect ratio", async () => {
		const source = await sharp({
			create: {
				width: 1600,
				height: 800,
				channels: 3,
				background: { r: 40, g: 50, b: 60 },
			},
		})
			.jpeg()
			.toBuffer();

		const derivatives = await generateDJWebPImageDerivatives(source);
		const [small, large] = await Promise.all([
			sharp(derivatives.image_400_webp).metadata(),
			sharp(derivatives.image_1024_webp).metadata(),
		]);

		expect(small).toMatchObject({ format: "webp", width: 400, height: 200 });
		expect(large).toMatchObject({ format: "webp", width: 1024, height: 512 });
	});

	test("does not enlarge narrow source images", async () => {
		const source = await sharp({
			create: {
				width: 300,
				height: 150,
				channels: 3,
				background: { r: 40, g: 50, b: 60 },
			},
		})
			.png()
			.toBuffer();

		const derivatives = await generateDJWebPImageDerivatives(source);
		expect(await sharp(derivatives.image_400_webp).metadata()).toMatchObject({
			width: 300,
			height: 150,
		});
		expect(await sharp(derivatives.image_1024_webp).metadata()).toMatchObject({
			width: 300,
			height: 150,
		});
	});

	test("stores missing derivatives once and reuses a complete cache", async () => {
		const { database, row } = createDatabase({
			id: 7,
			image: Buffer.from("source"),
			image_400_webp: null,
			image_1024_webp: null,
		});
		let generatedCount = 0;
		const generate = async () => {
			generatedCount += 1;
			return {
				image_400_webp: Buffer.from("small"),
				image_1024_webp: Buffer.from("large"),
			};
		};

		await cacheDJWebPImageDerivatives(database, [row] as never, generate);
		await cacheDJWebPImageDerivatives(database, [row] as never, generate);

		expect(generatedCount).toBe(1);
		expect(row).toMatchObject({
			image_400_webp: Buffer.from("small"),
			image_1024_webp: Buffer.from("large"),
		});
	});
});
