import { P } from "ts-pattern";

export const RemoveTagRequestPattern = {
	id: P.number.int().between(1, Number.MAX_SAFE_INTEGER),
} as const;
export type RemoveTagRequest = P.infer<typeof RemoveTagRequestPattern>;
export type RemoveTagResponse = { id: number };
export type TagDeleteImpact = {
	tag: { id: number; title: string };
	shows: { id: number; title: string }[];
	djs: {
		id: number;
		title: string;
		assignment: "direct" | "inherited" | "both";
	}[];
};

export const CreateTagRequestPattern = {
	title: P.string.minLength(1),
	color: P.optional(P.string.regex(/^#[0-9a-fA-F]{6}$/)), // hex color pattern
	mixcloud_key: P.optional(P.string.minLength(1)),
	mixcloud_url: P.optional(P.string.minLength(1)),
} as const;

export type CreateTagRequest = P.infer<typeof CreateTagRequestPattern>;

export const CreateTagsRequestPattern = P.array(CreateTagRequestPattern);

export type CreateTagsRequest = P.infer<typeof CreateTagsRequestPattern>;

/** Full editing retains identity and replaces editable metadata. */
export const ModifyTagFullEditRequestPattern = {
	edit_type: "full_edit",
	id: P.number.int().between(1, Number.MAX_SAFE_INTEGER),
	title: P.string,
	color: P.string,
	mixcloud_key: P.optional(P.string),
	mixcloud_url: P.optional(P.string),
	reviewed: P.optional(undefined),
} as const;
export type ModifyTagFullEditRequest = P.infer<
	typeof ModifyTagFullEditRequestPattern
>;

/** Review updates change only review status. */
export const ModifyTagReviewRequestPattern = {
	edit_type: "review",
	id: P.number.int().between(1, Number.MAX_SAFE_INTEGER),
	reviewed: P.boolean,
	title: P.optional(undefined),
	color: P.optional(undefined),
	mixcloud_key: P.optional(undefined),
	mixcloud_url: P.optional(undefined),
} as const;
export type ModifyTagReviewRequest = P.infer<
	typeof ModifyTagReviewRequestPattern
>;
export const ModifyTagRequestPattern = P.union(
	ModifyTagFullEditRequestPattern,
	ModifyTagReviewRequestPattern,
);
export type ModifyTagRequest = P.infer<typeof ModifyTagRequestPattern>;

/** Existing title validation and Mixcloud key resolution share one endpoint. */
export const ValidateTagsRequestPattern = P.union(
	{ tags: P.array(P.string), mixcloud_keys: P.optional(undefined) },
	{ mixcloud_keys: P.array(P.string), tags: P.optional(undefined) },
);
export type ValidateTagsRequest = P.infer<typeof ValidateTagsRequestPattern>;
export type ResolveMixcloudTagsResponse = {
	valid: { key: string; tag: { id: number; title: string; color: string } }[];
	invalid: string[];
};
