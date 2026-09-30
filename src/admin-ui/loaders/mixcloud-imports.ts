import type { MixcloudImportAdminRow } from "../../admin/routes/mixcloud-imports/index.js";

export type { MixcloudImportAdminRow } from "../../admin/routes/mixcloud-imports/index.js";
export const loadMixcloudImports = async (
	fetcher: typeof fetch = fetch,
): Promise<MixcloudImportAdminRow[]> => {
	const response = await fetcher("/api/admin/mixcloud-imports");
	if (!response.ok) throw new Error("Unable to load Mixcloud imports");
	return (await response.json()) as MixcloudImportAdminRow[];
};
