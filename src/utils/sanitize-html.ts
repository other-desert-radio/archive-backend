import sanitizeHtml from "sanitize-html";

const allowedTags = ["p", "br", "strong", "em", "ul", "ol", "li"];

/** Keeps only the small formatting vocabulary supported by archive editors. */
export const sanitizeArchiveHtml = (value: string): string =>
	sanitizeHtml(value, {
		allowedTags,
		allowedAttributes: {},
		allowedSchemes: [],
	});
