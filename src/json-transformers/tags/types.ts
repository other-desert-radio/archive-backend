import type { Selectable } from "kysely";
import type { TagsTable } from "../../db/types.js";

export type TagsJSON = {
	id: number;
	title: string;
	color: string;
};

export type TransformTagsParams = {
	tags: Array<Selectable<TagsTable>>;
};
