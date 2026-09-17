import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";

export type TypedDatabase = Kysely<Database>;

export type ErrorResponse = {
	error: string;
};

export type AdminApiReply<T> = {
	200: T;
	201: T;
	400: ErrorResponse;
	500: ErrorResponse;
};
