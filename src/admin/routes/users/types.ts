export type AccountRole = "admin" | "editor";
export type UserSummary = {
	id: string;
	email: string;
	role: AccountRole;
	mustChangePassword: boolean;
};
