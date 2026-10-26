export const CROPPED_IMAGE_SIZE = 1200;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ImageFileValidation =
	| { valid: true; file: File }
	| { valid: false; error: string };

/** Validates supported source-image MIME types before the browser crops them. */
export const validateImageFile = (file: File): ImageFileValidation => {
	if (!acceptedImageTypes.has(file.type))
		return { valid: false, error: "Image must be a JPEG, PNG, or WebP file" };

	return { valid: true, file };
};

/** Produces the normalized WebP filename for a cropped image. */
export const croppedImageFilename = (filename: string): string => {
	const stem = filename.replace(/\.[^.]+$/, "");
	return `${stem === "" ? "image" : stem}.webp`;
};

/** Confirms that a browser can decode an otherwise valid image file. */
export const decodeImageFile = async (
	file: File,
): Promise<ImageFileValidation> => {
	try {
		const image = await createImageBitmap(file);
		image.close();
		return { valid: true, file };
	} catch {
		return { valid: false, error: "Image could not be opened" };
	}
};
