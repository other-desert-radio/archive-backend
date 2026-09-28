import { extname } from "node:path";

export const MAX_DJ_IMAGE_BYTES = 1.5 * 1024 * 1024;

type DJImageFormat = {
	extensions: string[];
	contentType: "image/jpeg" | "image/png" | "image/webp";
};

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

const formats: DJImageFormat[] = [
	{
		extensions: [".jpg", ".jpeg"],
		contentType: "image/jpeg",
	},
	{
		extensions: [".png"],
		contentType: "image/png",
	},
	{
		extensions: [".webp"],
		contentType: "image/webp",
	},
];

const formatForContentType = (contentType: string): DJImageFormat | undefined =>
	formats.find((format) => format.contentType === contentType);

/** Validates uploaded image metadata before Sharp creates the stored WebPs. */
export const validateDJImageUpload = (
	upload: DJImageUpload,
): DJImageValidationResult => {
	if (upload.bytes.length > MAX_DJ_IMAGE_BYTES) {
		return { valid: false, error: "Image must be 1.5 MiB or smaller" };
	}

	const format = formatForContentType(upload.contentType);
	if (format === undefined) {
		return {
			valid: false,
			error: "Image must have a JPEG, PNG, or WebP MIME type",
		};
	}

	const extension = extname(upload.filename ?? "").toLowerCase();
	if (extension !== "" && !format.extensions.includes(extension)) {
		return {
			valid: false,
			error: "Image filename extension does not match its MIME type",
		};
	}

	return {
		valid: true,
		image: {
			bytes: upload.bytes,
		},
	};
};
