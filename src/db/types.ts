import type { Generated } from "kysely";

export type Database = {
	djs: DjsTable;
};

export type DjsTable = {
	id: Generated<number>;
	title: string;
	bio: string;
	image: string | null;
};
