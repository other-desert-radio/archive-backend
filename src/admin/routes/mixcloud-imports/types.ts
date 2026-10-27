import { P } from "ts-pattern";
import { CloudcastPattern } from "../../../mixcloud/index.js";

export {
	CloudcastPattern,
	type MixcloudCloudcast,
	type MixcloudPictures,
	PicturesPattern,
} from "../../../mixcloud/index.js";

import type { AdminApiReply } from "../types.js";

export const PagePattern = {
	data: P.array(CloudcastPattern),
	paging: P.optional({ next: P.optional(P.union(P.string, null)) }),
} as const;

export type MixcloudPage = P.infer<typeof PagePattern>;
export type MixcloudCloudcasts = Pick<MixcloudPage, "data">;

/** JSON contract for the authenticated, read-only Mixcloud import list. */
export type MixcloudImportAdminRow = {
	data_changed: boolean;
	id: number;
	key: string;
	url?: string;
	name?: string;
	created_time?: string;
	derived_title?: string;
	derived_date?: string;
	decoded_djs_exist?: boolean;
	decoded_djs?: string[];
	parser_version?: number;
	parser_key?: string;
	date_source?: "title" | "created_time";
	image_small?: string;
	image_large?: string;
	show_id?: number;
	imported_at?: string;
	show_name?: string;
	djs: number[];
	dj_names: string[];
	mixcloud_tags?: { key: string; name: string; url: string }[];
	duration?: number;
	tags: number[];
};
/** Temporary response contract for the Mixcloud refresh scaffold. */
export type RefreshMixcloudResponse = { status: "ok" };

/** Counts of pending source rows by import readiness. */
export type MixcloudImportStatus = {
	auto_parsed: number;
	unparsable: number;
	missing_djs: string[];
};

export type RefreshMixcloudRoute = {
	Reply: AdminApiReply<RefreshMixcloudResponse>;
};

export type GetMixcloudImportStatusRoute = {
	Reply: AdminApiReply<MixcloudImportStatus>;
};

export type ListMixcloudImportsRoute = {
	Reply: AdminApiReply<MixcloudImportAdminRow[]>;
};
