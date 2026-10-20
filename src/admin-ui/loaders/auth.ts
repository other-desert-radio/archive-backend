import { isMatching, match, P } from "ts-pattern";
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
	const result: unknown = await response.json();
	if (!response.ok)
		throw new Error(
			match(result)
				.with({ error: P.string }, ({ error }) => error)
				.with({ error: { message: P.string } }, ({ error }) => error.message)
				.with({ message: P.string }, ({ message }) => message)
				.otherwise(
					() => "The request could not be completed. Please try again.",
				),
		);
	return result as T;
};
export const loadSession = async (): Promise<AccountUser | undefined> => {
	let response: Response;
	try {
		response = await apiFetch("/api/auth/get-session");
	} catch {
		throw new Error(
			"Unable to reach the sign-in service. Check your connection and retry.",
		);
	}
	const reference = response.headers.get("x-request-id");
	const details = `HTTP ${response.status}${reference && /^[a-zA-Z0-9_-]{1,100}$/.test(reference) ? `; reference ${reference}` : ""}`;
	if (!response.ok) {
		if (response.status === 429)
			throw new Error(
				`Too many session checks. Wait a minute, then retry. (${details})`,
			);
		throw new Error(
			`The sign-in service could not check your session. Retry; if this continues, contact the administrator. (${details})`,
		);
	}
	let session: unknown;
	try {
		session = await response.json();
	} catch {
		throw new Error(
			`The sign-in service returned an unreadable response. Contact the administrator. (${details})`,
		);
	}
	if (session === null) return undefined;
	if (
		isMatching(
			{
				user: {
					id: P.string,
					email: P.string,
					role: P.union("admin", "editor"),
					mustChangePassword: P.boolean,
				},
			},
			session,
		)
	)
		return session.user;
	throw new Error(
		`The sign-in service returned an unexpected response. Contact the administrator. (${details})`,
	);
};
