import { P } from "ts-pattern";
import type { ShowsJSON } from "../../../json-transformers/index.js";

/** Admin list responses retain the creation timestamp selected from the database. */
export type AdminShowsJSON = ShowsJSON & {
	createdAt: Date;
	image_small: string;
	image_large: string;
};

const ShowFieldsPattern = {
	title: P.string,
	date: P.string,
	duration: P.number,
	url: P.string,
	djs: P.array(P.number),
	image_small: P.string,
	image_large: P.string,
	tags: P.optional(P.array(P.string)),
} as const;
export const CreateShowRequestPattern = {
	...ShowFieldsPattern,
	mixcloud_import_id: P.optional(
		P.number.int().between(1, Number.MAX_SAFE_INTEGER),
	),
} as const;
export type CreateShowRequest = P.infer<typeof CreateShowRequestPattern>;

/** Editing replaces the same fields as creation, retaining identity and createdAt. */
export const ModifyShowRequestPattern = {
	...ShowFieldsPattern,
	id: P.number.int().between(1, Number.MAX_SAFE_INTEGER),
} as const;
export type ModifyShowRequest = P.infer<typeof ModifyShowRequestPattern>;
