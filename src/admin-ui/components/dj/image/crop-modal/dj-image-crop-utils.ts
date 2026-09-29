import type { Area } from "react-easy-crop";
import {
	croppedDJImageFilename,
	DJ_CROPPED_IMAGE_SIZE,
} from "../utils/dj-image-utils.js";

export type DJImageRotation = 0 | 90 | 180 | 270;

/** Moves a quarter-turn rotation in either direction while retaining 0–270°. */
export const rotateDJImage = (
	rotation: DJImageRotation,
	direction: -90 | 90,
): DJImageRotation => ((rotation + direction + 360) % 360) as DJImageRotation;

/** Returns the source dimensions after a quarter-turn rotation. */
export const rotatedDJImageDimensions = (
	width: number,
	height: number,
	rotation: DJImageRotation,
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

const rotateImage = (
	image: ImageBitmap,
	rotation: DJImageRotation,
): HTMLCanvasElement => {
	const dimensions = rotatedDJImageDimensions(
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
export const cropDJImage = async (
	file: File,
	area: Area,
	rotation: DJImageRotation,
): Promise<File> => {
	const image = await createImageBitmap(file);
	try {
		const rotatedImage = rotateImage(image, rotation);
		const canvas = document.createElement("canvas");
		canvas.width = DJ_CROPPED_IMAGE_SIZE;
		canvas.height = DJ_CROPPED_IMAGE_SIZE;
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
			DJ_CROPPED_IMAGE_SIZE,
			DJ_CROPPED_IMAGE_SIZE,
		);
		const blob = await canvasToWebP(canvas);
		return new File([blob], croppedDJImageFilename(file.name), {
			type: "image/webp",
		});
	} finally {
		image.close();
	}
};
