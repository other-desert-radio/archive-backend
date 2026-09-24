import type { ShowsJSON } from "../../../json-transformers/index.js";

/** Admin list responses retain the creation timestamp selected from the database. */
export type AdminShowsJSON = ShowsJSON & {
	createdAt: Date;
};
