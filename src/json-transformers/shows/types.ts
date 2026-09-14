import type { Selectable } from "kysely";
import type {
	ShowDJsTable,
	ShowsTable,
	ShowTagsTable,
} from "../../db/types.js";

export type ShowsJSON = {
	id: number;
	title: string;
	date: Date;
	image?: string;
	duration: number;
	djs: number[];
	tags: number[];
	url: string;
};

export type TransformShowsParams = {
	shows: Array<Selectable<ShowsTable>>;
	showDJs: Array<Pick<Selectable<ShowDJsTable>, "dj_id" | "show_id">>;
	showTags: Array<
		Pick<Selectable<ShowDJsTable>, "dj_id"> &
			Pick<Selectable<ShowTagsTable>, "tag_id">
	>;
};
