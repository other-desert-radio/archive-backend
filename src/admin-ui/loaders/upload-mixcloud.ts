import { isMatching } from "ts-pattern";
import { apiFetch } from "./api-fetch.js";

/** Posts audio directly to our server; browser credentials never include a provider token. */
export const uploadMixcloud = async (fields: {
	title: string;
	date: string;
	tags: string[];
	mp3: File;
}): Promise<void> => {
	const body = new FormData();
	body.set("title", fields.title);
	body.set("date", fields.date);
	body.set("tags", JSON.stringify(fields.tags));
	body.set("mp3", fields.mp3);
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
	if (response.status === 501)
		throw new Error(
			"MP3 validation completed. Mixcloud upload is not connected yet.",
		);
	if (response.status === 413)
		throw new Error("The upload exceeds the allowed size or field limits.");
	const result: unknown = await response.json();
	if (!response.ok || !isMatching({ success: true }, result))
		throw new Error("Upload failed. Check your MP3, title, date, and tags.");
};
