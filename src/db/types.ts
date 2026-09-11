import type { Generated } from "kysely";

export type Database = {
	djs: DjsTable;
	shows: ShowsTable;
	tags: TagsTable;
	show_djs: ShowDjsTable;
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
