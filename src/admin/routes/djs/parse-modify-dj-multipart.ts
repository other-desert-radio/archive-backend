import type { FastifyRequest } from "fastify";
import { splitCommaSeparated } from "../../../utils/index.js";
import { clientDescription } from "../../logging.js";
import type { ModifyDJRequest } from "./types.js";
import type { DJImageUpload } from "./validate-dj-image.js";

type ModifyDJMultipartFields = {
	id?: string;
	title?: string;
	bio?: string;
	tags?: string;
	socials?: string;
	showTitle?: string;
	showDescription?: string;
	removeImage?: string;
	image?: DJImageUpload;
};

export type ModifyDJMultipartForm = Omit<ModifyDJRequest, "image"> & {
	image?: DJImageUpload;
};

export type ModifyDJMultipartResult =
	| { valid: true; form: ModifyDJMultipartForm }
	| { valid: false; error: string };

const textFields = new Set([
	"id",
	"title",
	"bio",
	"tags",
	"socials",
	"showTitle",
	"showDescription",
	"removeImage",
]);

/** Parses the complete replacement payload accepted by the DJ edit route. */
export const parseModifyDJMultipart = async (
	request: FastifyRequest,
): Promise<ModifyDJMultipartResult> => {
	if (!request.isMultipart())
		return { valid: false, error: "Request must use multipart/form-data" };

	const fields: ModifyDJMultipartFields = {};
	const seenFields = new Set<string>();
	for await (const part of request.parts()) {
		request.log.info(
			{
				field: part.fieldname,
				partType: part.type,
				...(part.type === "file"
					? { filename: part.filename, contentType: part.mimetype }
					: {}),
				client: clientDescription(request),
			},
			`[DJ Modification] multipart field received -- field: ${part.fieldname}, type: ${part.type}`,
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
				`[DJ Modification [image upload]] image attached -- field: ${part.fieldname}, filename: ${part.filename}, content type: ${part.mimetype}, bytes: ${bytes.length}`,
			);
			if (part.fieldname !== "image")
				return {
					valid: false,
					error: `Unexpected multipart field: ${part.fieldname}`,
				};
			fields.image = {
				bytes,
				filename: part.filename,
				contentType: part.mimetype,
			};
			continue;
		}

		if (!textFields.has(part.fieldname))
			return {
				valid: false,
				error: `Unexpected multipart field: ${part.fieldname}`,
			};
		fields[part.fieldname as keyof Omit<ModifyDJMultipartFields, "image">] =
			String(part.value);
	}

	if (fields.removeImage !== "true" && fields.removeImage !== "false")
		return { valid: false, error: "removeImage must be true or false" };

	return {
		valid: true,
		form: {
			id: Number(fields.id),
			title: fields.title ?? "",
			bio: fields.bio ?? "",
			tags: splitCommaSeparated(fields.tags ?? ""),
			...(fields.socials?.trim() === "" || fields.socials === undefined
				? {}
				: { socials: fields.socials }),
			...(fields.showTitle?.trim() === "" || fields.showTitle === undefined
				? {}
				: { showTitle: fields.showTitle }),
			...(fields.showDescription?.trim() === "" ||
			fields.showDescription === undefined
				? {}
				: { showDescription: fields.showDescription }),
			removeImage: fields.removeImage === "true",
			...(fields.image === undefined ? {} : { image: fields.image }),
		},
	};
};
