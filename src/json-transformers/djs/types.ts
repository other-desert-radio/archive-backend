import type { Selectable } from "kysely";
import type {
	DJsTable,
	DjTagsTable,
	ShowDJsTable,
	ShowTagsTable,
} from "../../db/types.js";

export type DJJSON = {
	id: number;
	title: string;
	bio: string;
	imagePath?: string;
	socials?: string;
	showTitle?: string;
	showDescription?: string;
	shows: number[];
	tags: number[];
};

export type TransformDJsParams = {
	djs: Array<Selectable<DJsTable>>;
	showDJs: Array<Pick<Selectable<ShowDJsTable>, "dj_id" | "show_id">>;
	djTags: Array<Pick<Selectable<DjTagsTable>, "dj_id" | "tag_id">>;
	showTags: Array<
		Pick<Selectable<ShowDJsTable>, "dj_id"> &
			Pick<Selectable<ShowTagsTable>, "tag_id">
	>;
};
