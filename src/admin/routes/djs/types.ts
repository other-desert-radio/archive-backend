import { P } from "ts-pattern";

export const CreateDJRequestPattern = {
	title: P.string,
	image: P.optional(P.string),
	tags: P.optional(P.array(P.string)),
	socials: P.optional(P.string),
	bio: P.string,
} as const;

export type CreateDJRequest = P.infer<typeof CreateDJRequestPattern>;
