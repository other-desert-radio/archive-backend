const MAX_DJ_IMAGE_BYTES = 10 * 1024 * 1024;

const acceptedImageTypes = new Map([
	["image/jpeg", [".jpg", ".jpeg"]],
	["image/png", [".png"]],
	["image/webp", [".webp"]],
]);

export type DJImageFileValidation =
	| { valid: true; file: File }
	| { valid: false; error: string };

/** Validates the same MIME, extension, and size policy enforced by the API. */
export const validateDJImageFile = (file: File): DJImageFileValidation => {
	if (file.size > MAX_DJ_IMAGE_BYTES) {
		return { valid: false, error: "Image must be 10 MiB or smaller" };
	}

	const extensions = acceptedImageTypes.get(file.type);
	const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
	if (extensions === undefined || !extensions.includes(extension)) {
		return {
			valid: false,
			error:
				"Image must be a JPEG, PNG, or WebP file with a matching extension",
		};
	}

	return { valid: true, file };
};
