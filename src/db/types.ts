import type { Generated } from "kysely";

export type Database = {
	djs: DjsTable;
	shows: ShowsTable;
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
	date: string; // TODO: time stamp?
	duration: number;
	image: string | null;
	url: string;
};
