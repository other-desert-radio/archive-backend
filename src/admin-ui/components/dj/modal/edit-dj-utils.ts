import { splitCommaSeparated } from "../../../../utils/index.js";

export type EditDJForm = {
	id: number;
	title: string;
	bio: string;
	tags: string[];
	socials?: string;
	showTitle?: string;
	showDescription?: string;
	image?: File;
	removeImage: boolean;
};

export type EditDJFieldValues = Omit<EditDJForm, "tags" | "image"> & {
	tags: string[];
	tagDraft: string;
	image?: File;
};

/** Builds the full-replacement payload for a DJ edit submission. */
export const buildEditDJRequest = (fields: EditDJFieldValues): EditDJForm => {
	const socials = fields.socials?.trim();
	const showTitle = fields.showTitle?.trim();
	const showDescription = fields.showDescription?.trim();

	return {
		id: fields.id,
		title: fields.title.trim(),
		bio: fields.bio.trim(),
		tags: splitCommaSeparated([...fields.tags, fields.tagDraft].join(",")),
		...(socials === "" || socials === undefined ? {} : { socials }),
		...(showTitle === "" || showTitle === undefined ? {} : { showTitle }),
		...(showDescription === "" || showDescription === undefined
			? {}
			: { showDescription }),
		...(fields.image === undefined ? {} : { image: fields.image }),
		removeImage: fields.removeImage,
	};
};

/** Converts the archive's constrained safe HTML fields into editable text. */
export const safeHtmlToPlainText = (html: string): string => {
	const container = document.createElement("div");
	container.innerHTML = html
		.replaceAll(/<br\s*\/?\s*>/giu, "\n")
		.replaceAll(/<\/(?:p|li)\s*>/giu, "\n");

	return (container.textContent ?? "").replace(/\n{3,}/gu, "\n\n").trim();
};
