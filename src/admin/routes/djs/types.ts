import { P } from "ts-pattern";
import type { DJJSON } from "../../../json-transformers/index.js";
import type { AdminApiReply, ErrorResponse } from "../types.js";

export const CreateDJRequestPattern = {
	title: P.string.minLength(1),
	image: P.optional(P.string.minLength(1)),
	tags: P.optional(P.array(P.string.minLength(1))),
	socials: P.optional(P.string.minLength(1)),
	showTitle: P.optional(P.string.minLength(1)),
	showDescription: P.optional(P.string.minLength(1)),
	bio: P.optional(P.string),
} as const;

export type CreateDJRequest = P.infer<typeof CreateDJRequestPattern>;

export const ModifyDJRequestPattern = {
	id: P.when(
		(value): value is number =>
			typeof value === "number" && Number.isSafeInteger(value) && value > 0,
	),
	title: P.string.minLength(1),
	tags: P.array(P.string.minLength(1)),
	socials: P.optional(P.string.minLength(1)),
	showTitle: P.optional(P.string.minLength(1)),
	showDescription: P.optional(P.string.minLength(1)),
	bio: P.optional(P.string),
	removeImage: P.boolean,
} as const;

export type ModifyDJRequest = P.infer<typeof ModifyDJRequestPattern>;

/** Includes direct assignments separately from tags inherited through shows. */
export type AdminDJJSON = DJJSON & { directTags: number[] };
export type ListDJsRoute = { Reply: AdminApiReply<AdminDJJSON[]> };

export type GetDJImageRoute = {
	Params: { id: string; variant: "small" | "large" };
	Reply: AdminApiReply<Buffer>;
};

export type GetDJDefaultImageRoute = {
	Params: { id: string };
	Reply: AdminApiReply<Buffer>;
};

export type CreateDJRoute = {
	Reply: AdminApiReply<DJJSON> & { 413: ErrorResponse };
};

export type ModifyDJRoute = {
	Reply: AdminApiReply<AdminDJJSON> & { 413: ErrorResponse };
};

export const RemoveDJRequestPattern = {
	id: P.number.int().between(1, Number.MAX_SAFE_INTEGER),
} as const;
export type RemoveDJRequest = P.infer<typeof RemoveDJRequestPattern>;
export type RemoveDJResponse = { id: number };
export type RemoveDJRoute = {
	Body: RemoveDJRequest;
	Reply: AdminApiReply<RemoveDJResponse> & { 409: ErrorResponse };
};
export type DJDeleteImpact = {
	dj: { id: number; title: string };
	shows: { id: number; title: string }[];
};
export type GetDJDeleteImpactRoute = {
	Params: { id: string };
	Reply: AdminApiReply<DJDeleteImpact>;
};
