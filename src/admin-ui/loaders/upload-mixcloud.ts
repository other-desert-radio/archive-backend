import { isMatching, P } from "ts-pattern";
import type { UploadedShowConfirmation } from "../../admin/routes/mixcloud/types.js";
import { apiFetch } from "./api-fetch.js";

/** Posts audio directly to our server; browser credentials never include a provider token. */
export const uploadMixcloud = async (fields: {
	title: string;
	mixcloud_title: string;
	date: string;
	djs: number[];
	tags: string[];
	mp3: File;
	image?: File;
	description?: string;
}): Promise<UploadedShowConfirmation> => {
	const body = new FormData();
	body.set("title", fields.title);
	body.set("mixcloud_title", fields.mixcloud_title);
	if (fields.description !== undefined)
		body.set("description", fields.description);
	body.set("date", fields.date);
	body.set("djs", JSON.stringify(fields.djs));
	body.set("tags", JSON.stringify(fields.tags));
	body.set("mp3", fields.mp3);
	if (fields.image !== undefined) body.set("image", fields.image);
	let response: Response;
	try {
		response = await apiFetch("/api/admin/mixcloud/upload", {
			method: "POST",
			body,
		});
	} catch {
		throw new Error(
			"Unable to confirm upload. Check Mixcloud before trying again.",
		);
	}
	if (response.status === 403)
		throw new Error("Reconnect Mixcloud before uploading again.");
	if (response.status === 503) throw new Error("Mixcloud is not configured.");
	if (response.status === 429)
		throw new Error("Mixcloud rate limit reached. Wait before trying again.");
	if (response.status === 502 || response.status === 504)
		throw new Error(
			"Unable to confirm Mixcloud upload. Check your Mixcloud account before retrying.",
		);
	if (response.status === 413)
		throw new Error("The upload exceeds the allowed size or field limits.");
	const result: unknown = await response.json();
	if (isMatching({ success: false, uploaded: true, url: P.string }, result))
		throw new Error(
			`Uploaded to Mixcloud, but the pending show could not be saved. Do not upload again. Show: ${result.url}`,
		);
	if (
		!response.ok ||
		!isMatching(
			{
				success: true,
				uploadId: P.number.int().positive(),
				key: P.string,
				url: P.string,
			},
			result,
		)
	)
		throw new Error(
			"Upload failed. Check your MP3, image, title, date, and tags.",
		);
	return result;
};
