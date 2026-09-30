import { P } from "ts-pattern";

export const CreateTagRequestPattern = {
	title: P.string.minLength(1),
	color: P.optional(P.string.regex(/^#[0-9a-fA-F]{6}$/)), // hex color pattern
	mixcloud_key: P.optional(P.string.minLength(1)),
	mixcloud_url: P.optional(P.string.minLength(1)),
} as const;

export type CreateTagRequest = P.infer<typeof CreateTagRequestPattern>;

export const CreateTagsRequestPattern = P.array(CreateTagRequestPattern);

export type CreateTagsRequest = P.infer<typeof CreateTagsRequestPattern>;

/** Editing retains identity and replaces all editable Tag metadata. */
export const ModifyTagRequestPattern = {
	id: P.number.int().between(1, Number.MAX_SAFE_INTEGER),
	title: P.string,
	color: P.string,
	mixcloud_key: P.optional(P.string),
	mixcloud_url: P.optional(P.string),
} as const;
export type ModifyTagRequest = P.infer<typeof ModifyTagRequestPattern>;
