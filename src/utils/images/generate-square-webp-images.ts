import sharp from "sharp";

export const SMALL_IMAGE_SIZE = 400;
export const LARGE_IMAGE_SIZE = 1024;
const WEBP_QUALITY = 82;

export type SquareWebPImages = {
	small: Buffer;
	large: Buffer;
};

const generateSquareWebPImage = (
	image: Buffer,
	size: number,
): Promise<Buffer> =>
	sharp(image)
		.rotate()
		.resize({
			width: size,
			height: size,
			fit: "cover",
			position: "centre",
		})
		.webp({ quality: WEBP_QUALITY })
		.toBuffer();

/** Generates the two square WebP variants shared by archive image resources. */
export const generateSquareWebPImages = async (
	image: Buffer,
): Promise<SquareWebPImages> => {
	const [small, large] = await Promise.all([
		generateSquareWebPImage(image, SMALL_IMAGE_SIZE),
		generateSquareWebPImage(image, LARGE_IMAGE_SIZE),
	]);

	return { small, large };
};
