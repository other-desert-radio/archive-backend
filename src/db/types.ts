import type { Generated } from "kysely";

export type Database = {
	djs: DjsTable;
	shows: ShowsTable;
	tags: TagsTable;
	show_djs: ShowDjsTable;
	show_tags: ShowTagsTable;
	dj_tags: DjTagsTable;
};

export type DjsTable = {
	id: Generated<number>;
	title: string;
	bio: string;
	image: string | null;
};

export type ShowsTable = {
	id: Generated<number>;
	title: string;
	date: Date;
	duration: number;
	image: string | null;
	url: string;
};

export type TagsTable = {
	id: Generated<number>;
	name: string;
	color: string | null;
};

export type ShowDjsTable = {
	id: Generated<number>;
	show_id: number;
	dj_id: number;
};

export type ShowTagsTable = {
	id: Generated<number>;
	show_id: number;
	tag_id: number;
};

export type DjTagsTable = {
	id: Generated<number>;
	dj_id: number;
	tag_id: number;
};
