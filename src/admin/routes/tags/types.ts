import { P } from "ts-pattern";

export const CreateTagRequestPattern = {
	title: P.string.minLength(1),
	color: P.optional(P.string.regex(/^#[0-9a-fA-F]{6}$/)), // hex color pattern
} as const;

export type CreateTagRequest = P.infer<typeof CreateTagRequestPattern>;

export const CreateTagsRequestPattern = P.array(CreateTagRequestPattern);

export type CreateTagsRequest = P.infer<typeof CreateTagsRequestPattern>;
