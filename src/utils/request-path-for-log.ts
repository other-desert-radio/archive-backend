/** Query strings can carry OAuth codes/state/tokens; log the path only. */
export const requestPathForLog = (url: string): string => {
	try {
		return new URL(url, "http://request.invalid").pathname;
	} catch {
		return "[invalid URL]";
	}
};
