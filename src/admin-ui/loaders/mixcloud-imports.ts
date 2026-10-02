import type {
	MixcloudImportAdminRow,
	MixcloudImportStatus,
	RefreshMixcloudResponse,
} from "../../admin/routes/mixcloud-imports/index.js";

export const refreshMixcloud = async (
	fetcher: typeof fetch = fetch,
): Promise<RefreshMixcloudResponse> => {
	const response = await fetcher("/api/admin/refresh-mixcloud", {
		method: "POST",
	}).catch((error: unknown) => {
		if (error instanceof Error && /credentials/i.test(error.message)) {
			throw new Error(
				"Your browser blocked the refresh because the page URL contains login credentials. Open the admin page without a username or password in the URL, sign in when prompted, and try again.",
			);
		}
		throw new Error(
			"The browser did not receive a response to the Mixcloud refresh request. The connection may have been interrupted or the browser may have blocked the request. Reload the page to check whether the refresh completed before trying again.",
		);
	});
	if (!response.ok)
		throw new Error(
			await describeMutationFailure(
				response,
				"Mixcloud",
				"Please try again. If this continues, contact the administrator.",
				"refreshed",
			),
		);
	const result: unknown = await response.json().catch(() => {
		throw new Error(
			"The server returned an unreadable refresh response. Please try again.",
		);
	});
	if (!isMatching({ status: "ok" }, result))
		throw new Error(
			"Mixcloud returned an unexpected refresh response. Please try again.",
		);
	return { status: "ok" };
};

export type { MixcloudImportAdminRow } from "../../admin/routes/mixcloud-imports/index.js";
export const loadMixcloudImports = async (
	fetcher: typeof fetch = fetch,
): Promise<MixcloudImportAdminRow[]> => {
	const response = await fetcher("/api/admin/mixcloud-imports");
	if (!response.ok) throw new Error("Unable to load Mixcloud imports");
	return (await response.json()) as MixcloudImportAdminRow[];
};

import { isMatching, P } from "ts-pattern";
import { describeMutationFailure } from "./mutation-error.js";

export type { MixcloudImportStatus } from "../../admin/routes/mixcloud-imports/index.js";
export const loadMixcloudImportStatus = async (
	fetcher: typeof fetch = fetch,
): Promise<MixcloudImportStatus> => {
	const response = await fetcher("/api/admin/mixcloud-import/status");
	if (!response.ok) throw new Error("Unable to load Mixcloud import status");
	const value: unknown = await response.json();
	if (
		!isMatching(
			{ auto_parsed: P.number.int().gte(0), unparsable: P.number.int().gte(0) },
			value,
		)
	)
		throw new Error("Invalid Mixcloud import status");
	return value;
};
