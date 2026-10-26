import type { Area } from "react-easy-crop";
import { CROPPED_IMAGE_SIZE, croppedImageFilename } from "../utils/index.js";

export type ImageRotation = 0 | 90 | 180 | 270;

/** Moves a quarter-turn rotation in either direction while retaining 0–270°. */
export const rotateImage = (
	rotation: ImageRotation,
	direction: -90 | 90,
): ImageRotation => ((rotation + direction + 360) % 360) as ImageRotation;

/** Returns the source dimensions after a quarter-turn rotation. */
export const rotatedImageDimensions = (
	width: number,
	height: number,
	rotation: ImageRotation,
) =>
	rotation === 90 || rotation === 270
		? { width: height, height: width }
		: { width, height };

const canvasToWebP = async (canvas: HTMLCanvasElement): Promise<Blob> =>
	new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob === null) {
					reject(new Error("Image could not be converted to WebP"));
					return;
				}
				resolve(blob);
			},
			"image/webp",
			0.9,
		);
	});

const rotateBitmap = (
	image: ImageBitmap,
	rotation: ImageRotation,
): HTMLCanvasElement => {
	const dimensions = rotatedImageDimensions(
		image.width,
		image.height,
		rotation,
	);
	const canvas = document.createElement("canvas");
	canvas.width = dimensions.width;
	canvas.height = dimensions.height;
	const context = canvas.getContext("2d");
	if (context === null) throw new Error("Image editor is unavailable");
	context.translate(canvas.width / 2, canvas.height / 2);
	context.rotate((rotation * Math.PI) / 180);
	context.drawImage(image, -image.width / 2, -image.height / 2);
	return canvas;
};

/** Renders the selected square crop into the archive's normalized WebP file. */
export const cropImage = async (
	file: File,
	area: Area,
	rotation: ImageRotation,
): Promise<File> => {
	const image = await createImageBitmap(file);
	try {
		const rotatedImage = rotateBitmap(image, rotation);
		const canvas = document.createElement("canvas");
		canvas.width = CROPPED_IMAGE_SIZE;
		canvas.height = CROPPED_IMAGE_SIZE;
		const context = canvas.getContext("2d");
		if (context === null) throw new Error("Image editor is unavailable");
		context.drawImage(
			rotatedImage,
			area.x,
			area.y,
			area.width,
			area.height,
			0,
			0,
			CROPPED_IMAGE_SIZE,
			CROPPED_IMAGE_SIZE,
		);
		const blob = await canvasToWebP(canvas);
		return new File([blob], croppedImageFilename(file.name), {
			type: "image/webp",
		});
	} finally {
		image.close();
	}
};
