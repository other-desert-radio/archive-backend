import { isMatching, P } from "ts-pattern";

type ErrorResponse = { error?: unknown };

/** Formats unsuccessful mutation responses with readable server and HTTP detail. */
export const describeMutationFailure = async (
	response: Response,
	resourceName: string,
	fallback: string,
): Promise<string> => {
	let serverError: string | undefined;
	try {
		const body = (await response.json()) as ErrorResponse;
		if (isMatching({ error: P.string.minLength(1) }, body))
			serverError = body.error;
	} catch {
		// A non-JSON response still has useful HTTP status information.
	}
	const status = `HTTP ${response.status}${response.statusText === "" ? "" : ` (${response.statusText})`}`;
	if (serverError === undefined)
		return `${resourceName} could not be created.\n\nStatus: ${status}\n${fallback}`;
	const detail =
		serverError === "Internal Server Error"
			? "The server encountered an unexpected error."
			: serverError;
	return `${resourceName} could not be created.\n\n${detail}\n\nStatus: ${status}\nPlease correct this issue and try again.`;
};
