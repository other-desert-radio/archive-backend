import type { Generated } from "kysely";

export type Database = {
	djs: DJsTable;
	shows: ShowsTable;
	tags: TagsTable;
	show_djs: ShowDJsTable;
	show_tags: ShowTagsTable;
	dj_tags: DjTagsTable;
	user: BetterAuthUserTable;
	session: BetterAuthSessionTable;
	account: BetterAuthAccountTable;
	verification: BetterAuthVerificationTable;
};

export type DJsTable = {
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

export type ShowDJsTable = {
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
