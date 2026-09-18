import type { FastifyRequest } from "fastify";
import type { DJImageUpload } from "./validate-dj-image.js";

export type CreateDJMultipartForm = {
	title?: string;
	bio?: string;
	tags?: string;
	socials?: string;
	image?: DJImageUpload;
};

export type CreateDJMultipartResult =
	| { valid: true; form: CreateDJMultipartForm }
	| { valid: false; error: string };

const textFields = new Set(["title", "bio", "tags", "socials"]);

/** Parses supported multipart fields without persisting or validating them. */
export const parseCreateDJMultipart = async (
	request: FastifyRequest,
): Promise<CreateDJMultipartResult> => {
	if (!request.isMultipart()) {
		return { valid: false, error: "Request must use multipart/form-data" };
	}

	const form: CreateDJMultipartForm = {};
	const seenFields = new Set<string>();

	try {
		for await (const part of request.parts()) {
			if (seenFields.has(part.fieldname)) {
				if (part.type === "file") await part.toBuffer();
				return {
					valid: false,
					error: `Multipart field was submitted more than once: ${part.fieldname}`,
				};
			}
			seenFields.add(part.fieldname);

			if (part.type === "file") {
				const bytes = await part.toBuffer();
				if (part.fieldname !== "image") {
					return {
						valid: false,
						error: `Unexpected multipart field: ${part.fieldname}`,
					};
				}
				form.image = {
					bytes,
					filename: part.filename,
					contentType: part.mimetype,
				};
				continue;
			}

			if (!textFields.has(part.fieldname)) {
				return {
					valid: false,
					error: `Unexpected multipart field: ${part.fieldname}`,
				};
			}

			form[part.fieldname as keyof Omit<CreateDJMultipartForm, "image">] =
				String(part.value);
		}
	} catch (error) {
		if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
			return { valid: false, error: "Image must be 10 MiB or smaller" };
		}
		throw error;
	}

	return { valid: true, form };
};
