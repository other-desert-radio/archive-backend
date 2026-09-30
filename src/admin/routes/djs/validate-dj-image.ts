const acceptedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

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
	if (!acceptedContentTypes.has(upload.contentType))
		return {
			valid: false,
			error: "Image must have a JPEG, PNG, or WebP MIME type",
		};

	return {
		valid: true,
		image: {
			bytes: upload.bytes,
		},
	};
};
