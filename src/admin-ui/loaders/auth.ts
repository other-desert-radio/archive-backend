import { apiFetch } from "./api-fetch.js";

export type { UserSummary as AccountUser } from "../../admin/routes/users/types.js";

import type { UserSummary as AccountUser } from "../../admin/routes/users/types.js";
export const authRequest = async <T>(
	url: string,
	body?: unknown,
): Promise<T> => {
	const response = await apiFetch(
		url,
		body === undefined
			? undefined
			: {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
	);
	const result = await response.json();
	if (!response.ok)
		throw new Error(
			typeof result.error === "string"
				? result.error
				: (result.error?.message ??
						result.message ??
						"The request could not be completed. Please try again."),
		);
	return result as T;
};
export const loadSession = async (): Promise<AccountUser | undefined> => {
	const session = await authRequest<{ user: AccountUser } | null>(
		"/api/auth/get-session",
	);
	return session?.user;
};
