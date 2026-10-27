import type { Selectable } from "kysely";
import { isMatching } from "ts-pattern";
import type { MixcloudUploadsTable } from "../../../../../db/types.js";
import {
	type MixcloudCloudcast,
	UploadedCloudcastPattern,
} from "../../../../../mixcloud/index.js";
import { persistMixcloudEntry } from "../../../mixcloud-imports/persist-mixcloud.js";
import { importShowInTransaction } from "../../../shows/import-show.js";
import { normalizeCreateShowRequest } from "../../../shows/normalize-create-show-request.js";
import { loadSavedShow } from "../../../shows/save-show.js";
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
	database: TypedDatabase,
	uploadId: number,
): Promise<UploadedShow | undefined> => {
	return database
		.selectFrom("mixcloud_uploads")
		.selectAll()
		.where("id", "=", uploadId)
		.executeTakeFirst();
};

/** Store only a validated cloudcast matching the pending upload's provider key. */
export const storeUploadedShowSnapshot = async (
	database: TypedDatabase,
	uploadId: number,
	cloudcast: MixcloudCloudcast,
): Promise<UploadedShow | undefined> => {
	if (!isMatching(UploadedCloudcastPattern, cloudcast))
		throw new Error("Invalid Mixcloud metadata");
	return database
		.updateTable("mixcloud_uploads")
		.set({ mixcloud_data: JSON.stringify(cloudcast) })
		.where("id", "=", uploadId)
		.where("mixcloud_key", "=", cloudcast.key)
		.where("show_id", "is", null)
		.returningAll()
		.executeTakeFirst();
};

/** Lock upload/source tracking; commit Show, relationships, and markers together.
 * Missing upload returns undefined; missing snapshot rejects Save; replay returns
 * the already saved Show. Provider fields come only from the validated snapshot.
 */
export const saveReviewedUpload = async (
	database: TypedDatabase,
	uploadId: number,
	reviewed: ReviewedUploadFields,
): Promise<SavedUploadedShow | undefined> => {
	return database.transaction().execute(async (transaction) => {
		const upload = await transaction
			.selectFrom("mixcloud_uploads")
			.selectAll()
			.where("id", "=", uploadId)
			.forUpdate()
			.executeTakeFirst();
		if (!upload) return undefined;
		if (upload.show_id !== null)
			return {
				created: false,
				show: await loadSavedShow(transaction, upload.show_id),
			};
		const cloudcast = upload.mixcloud_data;
		if (
			!isMatching(UploadedCloudcastPattern, cloudcast) ||
			cloudcast.key !== upload.mixcloud_key
		)
			throw new Error("Prepare Mixcloud metadata before saving");
		const normalized = normalizeCreateShowRequest({
			title: reviewed.title,
			description: reviewed.description,
			date: reviewed.date,
			djs: reviewed.djs,
			url: cloudcast.url,
			duration: cloudcast.audio_length,
			mixcloud_image_small: cloudcast.pictures.large,
			mixcloud_image_large: cloudcast.pictures["1024wx1024h"],
			tags: reviewed.tags ?? cloudcast.tags.map(({ name }) => name),
		});
		await persistMixcloudEntry(transaction, cloudcast);
		const tracking = await transaction
			.selectFrom("mixcloud_import")
			.select("id")
			.where("key", "=", cloudcast.key)
			.executeTakeFirstOrThrow();
		const result = await importShowInTransaction(
			transaction,
			normalized,
			tracking.id,
		);
		if (!result) throw new Error("Mixcloud source tracking disappeared");
		await transaction
			.updateTable("mixcloud_uploads")
			.set({ show_id: result.show.id })
			.where("id", "=", uploadId)
			.executeTakeFirstOrThrow();
		return result;
	});
};
