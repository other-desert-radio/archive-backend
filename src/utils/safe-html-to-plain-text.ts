/** Converts constrained archive HTML to readable editor/search text. */
export const safeHtmlToPlainText = (html: string): string =>
	html
		.replace(/<br\s*\/?\s*>|<\/(?:p|li)\s*>/giu, "\n")
		.replace(/<[^>]*>/gu, "")
		.replace(
			/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/giu,
			(entity, code: string) => {
				if (code.startsWith("#")) {
					const value =
						code[1]?.toLowerCase() === "x"
							? Number.parseInt(code.slice(2), 16)
							: Number(code.slice(1));
					return value > 0 && value <= 0x10ffff
						? String.fromCodePoint(value)
						: entity;
				}
				switch (code.toLowerCase()) {
					case "amp":
						return "&";
					case "lt":
						return "<";
					case "gt":
						return ">";
					case "quot":
						return '"';
					case "apos":
						return "'";
					case "nbsp":
						return "\u00a0";
					default:
						return entity;
				}
			},
		)
		.replace(/\n{3,}/gu, "\n\n")
		.trim();
