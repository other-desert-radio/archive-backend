import type { ColumnType, Generated } from "kysely";

export type Database = {
	djs: DJsTable;
	shows: ShowsTable;
	tags: TagsTable;
	show_djs: ShowDJsTable;
	show_tags: ShowTagsTable;
	dj_tags: DjTagsTable;
	mixcloud_import: MixcloudImportTable;
	user: BetterAuthUserTable;
	session: BetterAuthSessionTable;
	account: BetterAuthAccountTable;
	verification: BetterAuthVerificationTable;
};

export type MixcloudImportTable = {
	data_changed: Generated<boolean>;
	id: Generated<number>;
	createdAt: Generated<Date>;
	key: string;
	mixcloud_tags: ColumnType<
		{ key: string; name: string; url?: string }[] | null,
		string | null | undefined,
		{ key: string; name: string; url?: string }[] | string | null
	>;
	url: string | null;
	name: string | null;
	created_time: Date | null;
	/** Show title extracted by the parser. */
	derived_title: string | null;
	/** Suggested show date, parsed from the title or taken from created_time. */
	derived_date: Date | null;
	/** Extracted, normalized DJ names; these are not archive DJ IDs. */
	decoded_djs: string[] | null;
	/** Version of the full parsing pipeline, including DJ and date normalization. */
	parser_version: number | null;
	/** Stable text identifier of the matcher that parsed the source title. */
	parser_key: string | null;
	/** Origin of the suggested date; created_time is Mixcloud's upload timestamp. */
	date_source: "title" | "created_time" | null;
	duration: number | null;
	image_small: string | null;
	image_large: string | null;
	show_id: number | null;
	imported_at: Date | null;
};

export type DJsTable = {
	id: Generated<number>;
	createdAt: Generated<Date>;
	title: string;
	bio: string;
	image_small: Buffer | null;
	image_large: Buffer | null;
	socials: string | null;
	showTitle: string | null;
	showDescription: string | null;
};

export type ShowsTable = {
	id: Generated<number>;
	createdAt: Generated<Date>;
	title: string;
	date: Date;
	duration: number;
	image_small: string;
	image_large: string;
	url: string;
};

export type TagsTable = {
	id: Generated<number>;
	createdAt: Generated<Date>;
	title: string;
	color: string;
	reviewed: boolean;
	mixcloud_key: string | null;
	mixcloud_url: string | null;
};

export type ShowDJsTable = {
	id: Generated<number>;
	createdAt: Generated<Date>;
	show_id: number;
	dj_id: number;
};

export type ShowTagsTable = {
	id: Generated<number>;
	createdAt: Generated<Date>;
	show_id: number;
	tag_id: number;
};

export type DjTagsTable = {
	id: Generated<number>;
	createdAt: Generated<Date>;
	dj_id: number;
	tag_id: number;
};

export type BetterAuthUserTable = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	role: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type BetterAuthSessionTable = {
	id: string;
	expiresAt: Date;
	token: string;
	createdAt: Date;
	updatedAt: Date;
	ipAddress: string | null;
	userAgent: string | null;
	userId: string;
};

export type BetterAuthAccountTable = {
	id: string;
	accountId: string;
	providerId: string;
	userId: string;
	accessToken: string | null;
	refreshToken: string | null;
	idToken: string | null;
	accessTokenExpiresAt: Date | null;
	refreshTokenExpiresAt: Date | null;
	scope: string | null;
	password: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type BetterAuthVerificationTable = {
	id: string;
	identifier: string;
	value: string;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
};
