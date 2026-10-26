import { openAsBlob } from "node:fs";
import { isMatching, P } from "ts-pattern";

export type MixcloudUpload = {
	title: string;
	tags: string[];
	path: string;
	imagePath?: string;
};
export type MixcloudUploadResult = {
	success: boolean;
	statusCode: 200 | 403 | 429 | 502 | 504;
	providerStatus?: number;
	/** Full diagnostic response, with credentials removed before it leaves this module. */
	responseBody?: string;
};

/** One upload attempt; never retain token-bearing URLs or network errors. */
export const uploadToMixcloud = async (
	accessToken: string,
	upload: MixcloudUpload,
	fetcher: (url: URL, options: RequestInit) => Promise<Response> = fetch,
): Promise<MixcloudUploadResult> => {
	if (!accessToken.trim()) throw new Error("Mixcloud access token is required");
	const body = new FormData();
	body.set("name", upload.title);
	upload.tags.forEach((tag, index) => {
		body.set(`tags-${index}-tag`, tag);
	});
	// Disk-backed Blob lets the runtime stream multipart audio without a whole-file buffer.
	body.set(
		"mp3",
		await openAsBlob(upload.path, { type: "audio/mpeg" }),
		"show.mp3",
	);
	const url = new URL("https://api.mixcloud.com/upload/");
	url.searchParams.set("access_token", accessToken);
	try {
		const response = await fetcher(url, {
			method: "POST",
			body,
			redirect: "error",
			signal: AbortSignal.timeout(30 * 60 * 1000),
		});
		const text = await response.text();
		// Redact token echoes even in non-JSON responses; keep the rest for API exploration.
		const responseBody = text
			.replace(
				/("(?:access_token|refresh_token|client_secret|authorization)"\s*:\s*)"(?:\\.|[^"\\])*"/gi,
				'$1"[REDACTED]"',
			)
			.replaceAll(accessToken, "[REDACTED]")
			.replaceAll(encodeURIComponent(accessToken), "[REDACTED]")
			.replace(
				/((?:access_token|refresh_token|client_secret|authorization)["']?\s*[:=]\s*["']?)[^"'\s&,}]+/gi,
				"$1[REDACTED]",
			);
		let result: unknown;
		try {
			result = JSON.parse(text);
		} catch {
			result = undefined;
		}
		const success =
			response.ok &&
			!isMatching({ error: P.nonNullable }, result) &&
			!isMatching({ result: { error: P.nonNullable } }, result) &&
			isMatching({ result: { success: true } }, result);
		return {
			success,
			providerStatus: response.status,
			responseBody,
			statusCode: success
				? 200
				: response.status === 401 ||
						(response.status === 403 && !response.headers.has("retry-after"))
					? 403
					: response.status === 429 || response.headers.has("retry-after")
						? 429
						: 502,
		};
	} catch (error) {
		return {
			success: false,
			statusCode: isMatching({ name: "TimeoutError" }, error) ? 504 : 502,
		};
	}
};
