import type { Selectable } from "kysely";
import type {
	DjTagsTable,
	DJsTable,
	ShowDJsTable,
	ShowTagsTable,
} from "../../db/types.js";

export type DJsJson = {
	id: number;
	title: string;
	bio: string;
	image?: string;
	shows: number[];
	tags: number[];
};

export type DJsSqlData = {
	djs: Array<Selectable<DJsTable>>;
	showDJs: Array<Selectable<ShowDJsTable>>;
	djTags: Array<Selectable<DjTagsTable>>;
	showTags: Array<
		Pick<Selectable<ShowDJsTable>, "dj_id"> &
			Pick<Selectable<ShowTagsTable>, "tag_id">
	>;
};
