const MAX_DJ_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const DJ_CROPPED_IMAGE_SIZE = 1200;

export type DJImageFileValidation =
	| { valid: true; file: File }
	| { valid: false; error: string };

/** Validates the WebP-only upload policy enforced by the API. */
export const validateDJImageFile = (file: File): DJImageFileValidation => {
	if (file.size > MAX_DJ_IMAGE_BYTES) {
		return { valid: false, error: "Image must be 1.5 MiB or smaller" };
	}

	if (file.type !== "image/webp")
		return { valid: false, error: "Image must be a WebP file" };

	return { valid: true, file };
};

/** Produces the normalized WebP filename for a cropped DJ image. */
export const croppedDJImageFilename = (filename: string): string => {
	const stem = filename.replace(/\.[^.]+$/, "");
	return `${stem === "" ? "image" : stem}.webp`;
};

/** Confirms that a browser can decode an otherwise valid image file. */
export const decodeDJImageFile = async (
	file: File,
): Promise<DJImageFileValidation> => {
	try {
		const image = await createImageBitmap(file);
		image.close();
		return { valid: true, file };
	} catch {
		return { valid: false, error: "Image could not be opened" };
	}
};
