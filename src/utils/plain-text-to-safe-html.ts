import { sanitizeArchiveHtml } from "./sanitize-html.js";

const escapeHtml = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

const escapeLine = (line: string): string => {
	const indentation = line.match(/^[ \t]*/)?.[0] ?? "";
	const preservedIndentation = [...indentation]
		.map((character) => (character === "\t" ? "&nbsp;".repeat(4) : "&nbsp;"))
		.join("");

	return `${preservedIndentation}${escapeHtml(line.slice(indentation.length))}`;
};

/**
 * Converts plain editor text into the sanitized HTML archive fields support.
 *
 * Line breaks become `<br>` elements, leading spaces and tabs are preserved as
 * non-breaking spaces, and unsafe input is escaped before sanitization.
 *
 * @param value - Plain text from a DJ bio or socials editor.
 * @returns Sanitized HTML containing one paragraph and preserved line breaks.
 */
export const plainTextToSafeHtml = (value: string): string =>
	sanitizeArchiveHtml(
		`<p>${value
			.split(/\r?\n/)
			.map((line) => escapeLine(line))
			.join("<br>")}</p>`,
	);
