import type { Selectable } from "kysely";
import type { MixcloudUploadsTable } from "../../../../../db/types.js";
import type { TypedDatabase } from "../../../types.js";

export type UploadedShow = Selectable<MixcloudUploadsTable>;

/** Editorial fields retained separately from provider transport metadata. */
export type UploadedShowDraft = {
	title: string;
	description?: string;
	date: string;
	djs: number[];
	mixcloud_title: string;
	tags: string[];
};

/** Called only after provider success; database failures must not imply upload failure. */
export const recordUploadedShow = async (
	_database: TypedDatabase,
	_userId: string,
	_draft: UploadedShowDraft,
	_mixcloudKey: string,
): Promise<UploadedShow> => {
	throw new Error("Not implemented: recordUploadedShow");
};
