/** Fetches management data and announces expired or restricted sessions. */
export const apiFetch: typeof fetch = async (input, init) => {
	const response = await fetch(input, init);
	if (typeof window !== "undefined" && response.status === 401)
		window.dispatchEvent(new Event("auth:expired"));
	if (typeof window !== "undefined" && response.status === 403) {
		const body = await response
			.clone()
			.json()
			.catch(() => undefined);
		if (body?.code === "PASSWORD_CHANGE_REQUIRED")
			window.dispatchEvent(new Event("auth:password-required"));
	}
	return response;
};
