import { P } from "ts-pattern";

export const CreateDJRequestPattern = {
	title: P.string.minLength(1),
	image: P.optional(P.string.minLength(1)),
	tags: P.optional(P.array(P.string.minLength(1))),
	socials: P.optional(P.string.minLength(1)),
	showTitle: P.optional(P.string.minLength(1)),
	showDescription: P.optional(P.string.minLength(1)),
	bio: P.string.minLength(1),
} as const;

export type CreateDJRequest = P.infer<typeof CreateDJRequestPattern>;
