export type AccountRole = "admin" | "editor";
export type UserSummary = {
	id: string;
	email: string;
	role: AccountRole;
	mustChangePassword: boolean;
};

export type ListedUser = UserSummary & {
	banned: boolean;
	banReason?: string | undefined;
	banExpires?: string | undefined;
	mixcloudName?: string | undefined;
	mixcloudKey?: string | undefined;
};
