import { isMatching, P } from "ts-pattern";
import type {
	PublicationEvent,
	PublicationJob,
	PublicationJobDetail,
	PublicationPreview,
	PublicationStatus,
} from "../../publication/index.js";
import { apiFetch } from "./api-fetch.js";

const root = "/api/admin/publication";
const targetPattern = P.union(
	{
		mode: "local",
		checkoutPath: P.string,
		repository: P.optional(P.string),
		branch: P.optional(P.string),
	},
	{
		mode: "remote",
		checkoutPath: P.string,
		repository: P.string,
		branch: P.string,
	},
);
const jobBasePattern = {
	id: P.string,
	stage: P.union(
		"queued",
		"validating",
		"synchronizing",
		"exporting",
		"committing",
		"pushing",
		"acknowledging",
	),
	revision: P.optional(P.string.regex(/^\d+$/)),
	retryJobId: P.optional(P.string),
	commitId: P.optional(P.string),
	createdAt: P.string,
	requestedBy: P.string,
	target: targetPattern,
};
const jobPattern = P.union(
	{ ...jobBasePattern, outcome: "running" },
	{
		...jobBasePattern,
		outcome: P.union("succeeded", "no-change", "failed", "interrupted"),
		completedAt: P.string,
		error: P.optional(P.string),
	},
);
const statusPattern = {
	mode: P.union("local", "remote"),
	target: targetPattern,
	revision: P.string.regex(/^\d+$/),
	publishedRevision: P.string.regex(/^\d+$/),
	pending: P.boolean,
	latestJob: P.optional(jobPattern),
};
const detailPattern = {
	job: jobPattern,
	logs: P.array({ sequence: P.number, timestamp: P.string, message: P.string }),
	logsTruncated: P.boolean,
};
const request = async (
	path: string,
	init?: RequestInit,
	allowMissing = false,
): Promise<unknown> => {
	const operation = path.startsWith("/preview")
		? "prepare publication preview"
		: init?.method === "POST"
			? "start publication"
			: path
				? "load publication job and logs"
				: "load publication status";
	let response: Response;
	try {
		response = await apiFetch(`${root}${path}`, init);
	} catch {
		throw new Error(
			`Could not ${operation}: the server could not be reached. Check your connection and reload status before retrying publication.`,
		);
	}
	if (allowMissing && response.status === 404) return undefined;
	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new Error(
			`Could not ${operation} (HTTP ${response.status}): the server returned an unreadable response. Reload status.`,
		);
	}
	if (!response.ok) {
		const detail =
			isMatching({ error: P.string.minLength(1) }, data) &&
			data.error !== "Internal Server Error"
				? data.error
				: "The server encountered an unexpected error. Reload status before retrying publication.";
		throw new Error(
			`Could not ${operation} (HTTP ${response.status}). ${detail}`,
		);
	}
	return data;
};
export const loadPublicationStatus = async (): Promise<PublicationStatus> => {
	const data = await request("");
	if (!isMatching(statusPattern, data))
		throw new Error("Invalid publication status response.");
	return data as PublicationStatus;
};
export const loadPublicationJob = async (
	jobId: string,
): Promise<PublicationJobDetail> => {
	const data = await request(`/jobs/${encodeURIComponent(jobId)}`);
	if (!isMatching(detailPattern, data))
		throw new Error("Invalid publication job response.");
	return data as PublicationJobDetail;
};
/** Retention may have removed an earlier retry attempt. */
export const loadPreviousPublicationJob = async (
	jobId: string,
): Promise<PublicationJobDetail | undefined> => {
	const data = await request(
		`/jobs/${encodeURIComponent(jobId)}`,
		undefined,
		true,
	);
	if (data === undefined) return undefined;
	if (!isMatching(detailPattern, data))
		throw new Error("Invalid publication job response.");
	return data as PublicationJobDetail;
};
export const startPublication = async (
	retryJobId?: string,
	previewId?: string,
): Promise<PublicationJob> => {
	const data = await request("", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			...(retryJobId ? { retryJobId } : {}),
			...(previewId ? { previewId } : {}),
		}),
	});
	if (!isMatching(jobPattern, data))
		throw new Error("Invalid publication start response.");
	return data as PublicationJob;
};
export type PublicationStreamOptions = {
	onEvent: (event: PublicationEvent) => void;
	onError: (error: unknown) => void;
	signal: AbortSignal;
};
/** Observation only: abort never cancels publication. Reconnect replays durable state. */
export const connectPublicationStream = async ({
	onEvent,
	onError,
	signal,
}: PublicationStreamOptions): Promise<void> => {
	try {
		const response = await apiFetch(`${root}/events`, {
			signal,
			headers: { Accept: "text/event-stream" },
		});
		if (!response.ok || !response.body)
			throw new Error("Publication connection unavailable.");
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		try {
			while (!signal.aborted) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder
					.decode(value, { stream: true })
					.replace(/\r\n/g, "\n");
				let boundary = buffer.indexOf("\n\n");
				while (boundary !== -1) {
					const frame = buffer.slice(0, boundary);
					buffer = buffer.slice(boundary + 2);
					const payload = frame
						.split("\n")
						.filter((line) => line.startsWith("data:"))
						.map((line) => line.slice(5).trimStart())
						.join("\n");
					if (payload) {
						const event: unknown = JSON.parse(payload);
						if (
							isMatching({ type: "status", status: statusPattern }, event) ||
							isMatching({ type: "job", detail: detailPattern }, event)
						)
							onEvent(event as PublicationEvent);
						else throw new Error("Invalid publication event.");
					}
					boundary = buffer.indexOf("\n\n");
				}
			}
		} finally {
			await reader.cancel();
		}
		if (!signal.aborted) throw new Error("Publication connection closed.");
	} catch (error) {
		if (!signal.aborted) onError(error);
	}
};

const summaryPattern = {
	added: P.array(P.string),
	changed: P.array(P.string),
	removed: P.array(P.string),
};
export const preparePublicationPreview = async (
	retryJobId?: string,
): Promise<PublicationPreview> => {
	const data = await request("/preview", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(retryJobId ? { retryJobId } : {}),
	});
	if (
		!isMatching(
			{
				id: P.string,
				expiresAt: P.string,
				revision: P.string.regex(/^\d+$/),
				changes: {
					tags: summaryPattern,
					shows: summaryPattern,
					djs: summaryPattern,
				},
			},
			data,
		)
	)
		throw new Error("Invalid publication preview response.");
	return data;
};
