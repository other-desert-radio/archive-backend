import type { Area } from "react-easy-crop";
import {
	croppedDJImageFilename,
	DJ_CROPPED_IMAGE_SIZE,
} from "./dj-image-utils.js";

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

/** Renders the selected square crop into the archive's normalized WebP file. */
export const cropDJImage = async (file: File, area: Area): Promise<File> => {
	const image = await createImageBitmap(file);
	try {
		const canvas = document.createElement("canvas");
		canvas.width = DJ_CROPPED_IMAGE_SIZE;
		canvas.height = DJ_CROPPED_IMAGE_SIZE;
		const context = canvas.getContext("2d");
		if (context === null) throw new Error("Image editor is unavailable");
		context.drawImage(
			image,
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
