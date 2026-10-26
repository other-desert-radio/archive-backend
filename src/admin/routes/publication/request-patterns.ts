import { P } from "ts-pattern";

export const uuidPattern = P.string.regex(
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);
export const previewRequestPattern = {
	retryJobId: P.optional(uuidPattern),
} as const;
