import { isMatching } from "ts-pattern";

/** Fetches management data and announces expired or restricted sessions. */
export const apiFetch: typeof fetch = async (input, init) => {
	const response = await fetch(input, init);
	if (typeof window !== "undefined" && response.status === 401)
		window.dispatchEvent(new Event("auth:expired"));
	if (typeof window !== "undefined" && response.status === 403) {
		const body: unknown = await response
			.clone()
			.json()
			.catch((error: unknown) => {
				console.error(
					"Unable to parse management API access error response",
					error,
				);
				return undefined;
			});
		if (isMatching({ code: "PASSWORD_CHANGE_REQUIRED" }, body))
			window.dispatchEvent(new Event("auth:password-required"));
	}
	return response;
};
