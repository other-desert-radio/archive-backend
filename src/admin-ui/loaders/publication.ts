import { isMatching, P } from "ts-pattern";
import type {
	PublicationEvent,
	PublicationJob,
	PublicationJobDetail,
	PublicationStatus,
} from "../../publication/index.js";
import { apiFetch } from "./api-fetch.js";

const root = "/api/admin/publication";
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
	target: { repository: P.string, checkoutPath: P.string, branch: P.string },
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
	enabled: P.boolean,
	branch: P.string,
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
const request = async (path: string, init?: RequestInit): Promise<unknown> => {
	const response = await apiFetch(`${root}${path}`, init);
	const data: unknown = await response.json();
	if (!response.ok)
		throw new Error(
			isMatching({ error: P.string }, data)
				? data.error
				: `Publication request failed (${response.status}).`,
		);
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
export const startPublication = async (
	retryJobId?: string,
): Promise<PublicationJob> => {
	const data = await request("", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(retryJobId ? { retryJobId } : {}),
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
