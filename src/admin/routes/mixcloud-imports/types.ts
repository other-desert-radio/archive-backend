/** JSON contract for the authenticated, read-only Mixcloud import list. */
export type MixcloudImportAdminRow = {
	id: number;
	key: string;
	url?: string;
	name?: string;
	created_time?: string;
	image_small?: string;
	image_large?: string;
	show_id?: number;
	imported_at?: string;
	show_name?: string;
	djs: number[];
	dj_names: string[];
	duration?: number;
	tags: number[];
};
