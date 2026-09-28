export const MAX_DJ_IMAGE_BYTES = 1.5 * 1024 * 1024;

export type DJImageUpload = {
	bytes: Buffer;
	filename?: string;
	contentType: string;
};

export type ValidatedDJImageUpload = {
	bytes: Buffer;
};

export type DJImageValidationResult =
	| { valid: true; image: ValidatedDJImageUpload }
	| { valid: false; error: string };

/** Validates uploaded image metadata before Sharp creates the stored WebPs. */
export const validateDJImageUpload = (
	upload: DJImageUpload,
): DJImageValidationResult => {
	if (upload.bytes.length > MAX_DJ_IMAGE_BYTES) {
		return { valid: false, error: "Image must be 1.5 MiB or smaller" };
	}

	if (upload.contentType !== "image/webp")
		return { valid: false, error: "Image must have a WebP MIME type" };

	return {
		valid: true,
		image: {
			bytes: upload.bytes,
		},
	};
};
