/** Checks whether a string parses as an absolute HTTP(S) URL. */
export const isHttpUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};
