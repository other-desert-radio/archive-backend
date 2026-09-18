import type { FastifyRequest } from "fastify";
import { clientDescription } from "../../logging.js";
import type { DJImageUpload } from "./validate-dj-image.js";

export type CreateDJMultipartForm = {
	title?: string;
	bio?: string;
	tags?: string;
	socials?: string;
	showTitle?: string;
	showDescription?: string;
	image?: DJImageUpload;
};

export type CreateDJMultipartResult =
	| { valid: true; form: CreateDJMultipartForm }
	| { valid: false; error: string };

const textFields = new Set([
	"title",
	"bio",
	"tags",
	"socials",
	"showTitle",
	"showDescription",
]);

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
			request.log.info(
				{
					field: part.fieldname,
					partType: part.type,
					...(part.type === "file"
						? {
								filename: part.filename,
								contentType: part.mimetype,
							}
						: {}),
					client: clientDescription(request),
				},
				`[DJ Creation] multipart field received -- field: ${part.fieldname}, type: ${part.type}`,
			);
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
				request.log.info(
					{
						field: part.fieldname,
						filename: part.filename,
						contentType: part.mimetype,
						byteLength: bytes.length,
						client: clientDescription(request),
					},
					`[DJ Creation [image upload]] image attached -- field: ${part.fieldname}, filename: ${part.filename}, content type: ${part.mimetype}, bytes: ${bytes.length}`,
				);
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
