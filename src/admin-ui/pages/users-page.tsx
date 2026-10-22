import { useCallback, useEffect, useState } from "react";
import type { ListedUser } from "../../admin/routes/users/types.js";
import { MessageModal } from "../components/shared/modal/index.js";
import {
	ResourceTable,
	type ResourceTableColumn,
	ResourceToolbar,
	ResourceView,
	type SortDirection,
} from "../components/shared/resource-views/index.js";
import { UserForm, type UserFormMode } from "../components/users/index.js";
import { type AccountUser, authRequest } from "../loaders/auth.js";

type UserSort =
	| "email"
	| "role"
	| "mustChangePassword"
	| "banned"
	| "banReason"
	| "banExpires"
	| "mixcloudName"
	| "mixcloudKey";

export const UsersPage = ({ currentUser }: { currentUser: AccountUser }) => {
	const [users, setUsers] = useState<ListedUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>();
	const [query, setQuery] = useState("");
	const [form, setForm] = useState<{
		mode: UserFormMode;
		user?: AccountUser;
	}>();
	const [deleting, setDeleting] = useState<AccountUser>();
	const [pending, setPending] = useState(false);
	const [deleteError, setDeleteError] = useState<string>();
	const [sort, setSort] = useState<UserSort>("email");
	const [direction, setDirection] = useState<SortDirection>("asc");
	const refresh = useCallback(() => {
		setLoading(true);
		setError(undefined);
		void authRequest<ListedUser[]>("/api/admin/users")
			.then(setUsers)
			.catch((error: Error) => setError(error.message))
			.finally(() => setLoading(false));
	}, []);
	useEffect(refresh, [refresh]);
	const columns: ResourceTableColumn<ListedUser, UserSort>[] = [
		{
			key: "email",
			label: "Email",
			render: (user) => user.email,
			compare: (a, b) => a.email.localeCompare(b.email),
		},
		{
			key: "role",
			label: "Role",
			render: (user) => user.role,
			compare: (a, b) => a.role.localeCompare(b.role),
		},
		...(
			[
				["mustChangePassword", "Password change required"],
				["banned", "Banned"],
				["banReason", "Ban reason"],
				["banExpires", "Ban expires (UTC)"],
				["mixcloudName", "Mixcloud name"],
				["mixcloudKey", "Mixcloud key"],
			] as const
		).map(([key, label]) => ({
			key,
			label,
			render: (user: ListedUser) => {
				const value = user[key];
				if (typeof value === "boolean") return value ? "Yes" : "No";
				if (!value) return "None";
				return key === "banExpires"
					? new Date(value)
							.toISOString()
							.replace("T", " ")
							.replace(".000Z", " UTC")
					: value;
			},
			compare: (a: ListedUser, b: ListedUser) =>
				String(a[key] ?? "").localeCompare(String(b[key] ?? "")),
		})),
	];
	const rows = users
		.filter((user) =>
			`${user.email} ${user.role} ${user.mustChangePassword ? "Yes" : "No"} ${user.banned ? "Yes" : "No"} ${user.banReason ?? ""} ${user.banExpires ?? ""} ${user.mixcloudName ?? ""} ${user.mixcloudKey ?? ""}`
				.toLowerCase()
				.includes(query.toLowerCase()),
		)
		.sort(
			(a, b) =>
				(columns.find((column) => column.key === sort)?.compare?.(a, b) ?? 0) *
				(direction === "asc" ? 1 : -1),
		);
	const deleteAccount = async () => {
		if (!deleting || pending) return;
		setPending(true);
		setDeleteError(undefined);
		try {
			await authRequest("/api/admin/remove-user", { id: deleting.id });
			setUsers((users) => users.filter((user) => user.id !== deleting.id));
			setDeleting(undefined);
		} catch (error) {
			setDeleteError(
				error instanceof Error ? error.message : "Unable to delete account.",
			);
		} finally {
			setPending(false);
		}
	};
	return (
		<>
			<div inert={Boolean(form || deleting)}>
				<ResourceView
					title="Users"
					isLoading={loading}
					error={error}
					onRetry={refresh}
					isEmpty={users.length === 0}
					emptyMessage="No accounts."
					hasNoResults={rows.length === 0}
					noResultsMessage="No matching accounts."
					toolbar={
						<ResourceToolbar
							query={query}
							onQueryChange={setQuery}
							searchLabel="Search Users"
							showViewControls={false}
							createLabel="+ account"
							onCreate={() => setForm({ mode: "create" })}
						/>
					}
				>
					<ResourceTable
						rows={rows}
						rowKey={(user) => user.id}
						caption="Management accounts"
						columns={columns}
						sortColumn={sort}
						sortDirection={direction}
						onSort={(column) => {
							setDirection(
								column === sort && direction === "asc" ? "desc" : "asc",
							);
							setSort(column);
						}}
						isEditDisabled={(user) => user.id === currentUser.id}
						isDeleteDisabled={(user) => user.id === currentUser.id}
						onEdit={(user) => setForm({ mode: "role", user })}
						onDelete={(user) => {
							setDeleteError(undefined);
							setDeleting(user);
						}}
						rowAction={{
							label: "Reset password",
							onClick: (user) => setForm({ mode: "reset", user }),
							isVisible: (user) => user.id !== currentUser.id,
						}}
					/>
				</ResourceView>
			</div>
			{form && (
				<UserForm
					{...form}
					onClose={() => setForm(undefined)}
					onSaved={refresh}
				/>
			)}
			{deleting && (
				<MessageModal
					title="Delete account?"
					message={`Permanently delete ${deleting.email}? This will end all of their sessions.`}
					role="alertdialog"
					initialFocus="secondary"
					restoreFocus
					onDismiss={() => {
						if (!pending) setDeleting(undefined);
					}}
					secondaryAction={{
						label: "Cancel",
						disabled: pending,
						onClick: () => setDeleting(undefined),
					}}
					primaryAction={{
						label: pending ? "Deleting…" : "Delete account",
						destructive: true,
						disabled: pending,
						onClick: () => {
							void deleteAccount();
						},
					}}
				>
					{deleteError && <p role="alert">{deleteError}</p>}
				</MessageModal>
			)}
		</>
	);
};
