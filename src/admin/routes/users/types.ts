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

export type ManagementReply = {
	200: UserSummary | { id: string };
	201: UserSummary;
	400: { error: string };
	401: { error: string };
	403: { error: string };
	404: { error: string };
	409: { error: string };
	429: { error: string };
	500: { error: string };
};
export type ListUsersRoute = {
	Reply: { 200: ListedUser[]; 500: { error: string } };
};

export type CreateUserRoute = { Body: unknown; Reply: ManagementReply };

export type ModifyUserRoleRoute = { Body: unknown; Reply: ManagementReply };

export type ResetUserPasswordRoute = { Body: unknown; Reply: ManagementReply };

export type RemoveUserRoute = { Body: unknown; Reply: ManagementReply };
