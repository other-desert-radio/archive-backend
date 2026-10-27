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
