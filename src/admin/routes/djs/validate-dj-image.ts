import { extname } from "node:path";

export const MAX_DJ_IMAGE_BYTES = 10 * 1024 * 1024;

type DJImageFormat = {
	extensions: string[];
	normalizedExtension: ".jpg" | ".png" | ".webp";
	contentType: "image/jpeg" | "image/png" | "image/webp";
};

export type DJImageUpload = {
	bytes: Buffer;
	filename?: string;
	contentType: string;
};

export type ValidatedDJImageUpload = {
	bytes: Buffer;
	filename: string;
	contentType: DJImageFormat["contentType"];
};

export type DJImageValidationResult =
	| { valid: true; image: ValidatedDJImageUpload }
	| { valid: false; error: string };

const formats: DJImageFormat[] = [
	{
		extensions: [".jpg", ".jpeg"],
		normalizedExtension: ".jpg",
		contentType: "image/jpeg",
	},
	{
		extensions: [".png"],
		normalizedExtension: ".png",
		contentType: "image/png",
	},
	{
		extensions: [".webp"],
		normalizedExtension: ".webp",
		contentType: "image/webp",
	},
];

const formatForContentType = (contentType: string): DJImageFormat | undefined =>
	formats.find((format) => format.contentType === contentType);

/** Returns the response MIME type represented by a normalized image filename. */
export const contentTypeForDJImageFilename = (
	filename: string,
): DJImageFormat["contentType"] | undefined => {
	const extension = extname(filename).toLowerCase();
	return formats.find((format) => format.extensions.includes(extension))
		?.contentType;
};

const normalizeFilename = (
	filename: string | undefined,
	format: DJImageFormat,
): string => {
	const basename = (filename ?? "image").replaceAll("\\", "/").split("/").pop();
	const stem = (basename ?? "image")
		.replace(/\.[^.]*$/, "")
		.replace(/[^a-zA-Z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return `${stem || "image"}${format.normalizedExtension}`;
};

/** Validates uploaded image metadata and normalizes its filename. */
export const validateDJImageUpload = (
	upload: DJImageUpload,
): DJImageValidationResult => {
	if (upload.bytes.length > MAX_DJ_IMAGE_BYTES) {
		return { valid: false, error: "Image must be 10 MiB or smaller" };
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
			filename: normalizeFilename(upload.filename, format),
			contentType: format.contentType,
		},
	};
};
