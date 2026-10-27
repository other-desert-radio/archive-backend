import type { Selectable } from "kysely";
import type { MixcloudUploadsTable } from "../../../../../db/types.js";
import type { MixcloudCloudcast } from "../../../../../mixcloud/index.js";
import type { TypedDatabase } from "../../../types.js";
import type { ReviewedUploadFields, SavedUploadedShow } from "../../types.js";

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
	database: TypedDatabase,
	userId: string,
	draft: UploadedShowDraft,
	mixcloudKey: string,
): Promise<UploadedShow> => {
	return database
		.insertInto("mixcloud_uploads")
		.values({
			...draft,
			date: new Date(`${draft.date}T00:00:00.000Z`),
			description: draft.description ?? null,
			created_by: userId,
			mixcloud_key: mixcloudKey,
			mixcloud_data: null,
			show_id: null,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
};

/** Read a pending or completed upload for preparation and replay. */
export const loadUploadedShow = async (
	_database: TypedDatabase,
	_uploadId: number,
): Promise<UploadedShow | undefined> => {
	throw new Error("Not implemented: loadUploadedShow");
};

/** Store only a validated cloudcast matching the pending upload's provider key. */
export const storeUploadedShowSnapshot = async (
	_database: TypedDatabase,
	_uploadId: number,
	_cloudcast: MixcloudCloudcast,
): Promise<UploadedShow | undefined> => {
	throw new Error("Not implemented: storeUploadedShowSnapshot");
};

/** Lock upload/source tracking; commit Show, relationships, and markers together.
 * Missing upload returns undefined; missing snapshot rejects Save; replay returns
 * the already saved Show. Provider fields come only from the validated snapshot.
 */
export const saveReviewedUpload = async (
	_database: TypedDatabase,
	_uploadId: number,
	_reviewed: ReviewedUploadFields,
): Promise<SavedUploadedShow | undefined> => {
	throw new Error("Not implemented: saveReviewedUpload");
};
