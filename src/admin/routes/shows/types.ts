import { P } from "ts-pattern";
import type { ShowsJSON } from "../../../json-transformers/index.js";

/** Admin list responses retain the creation timestamp selected from the database. */
export type AdminShowsJSON = ShowsJSON & {
	createdAt: Date;
};

export const CreateShowRequestPattern = {
	title: P.string,
	date: P.string,
	duration: P.number,
	url: P.string,
	djs: P.array(P.number),
	image: P.optional(P.string),
	tags: P.optional(P.array(P.string)),
} as const;
export type CreateShowRequest = P.infer<typeof CreateShowRequestPattern>;
