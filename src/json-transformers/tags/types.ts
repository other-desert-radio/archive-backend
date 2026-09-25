import type { Selectable } from "kysely";
import type { TagsTable } from "../../db/types.js";

export type TagsJSON = {
	id: number;
	title: string;
	color: string;
	reviewed: boolean;
	mixcloud_key?: string;
	mixcloud_url?: string;
};

export type TransformTagsParams = {
	tags: Array<Selectable<TagsTable>>;
};
