import { useCallback, useEffect, useState } from "react";
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
export const UsersPage = ({ currentUser }: { currentUser: AccountUser }) => {
	const [users, setUsers] = useState<AccountUser[]>([]);
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
	const [sort, setSort] = useState<"email" | "role">("email");
	const [direction, setDirection] = useState<SortDirection>("asc");
	const refresh = useCallback(() => {
		setLoading(true);
		setError(undefined);
		void authRequest<AccountUser[]>("/api/admin/users")
			.then(setUsers)
			.catch((error: Error) => setError(error.message))
			.finally(() => setLoading(false));
	}, []);
	useEffect(refresh, [refresh]);
	const columns: ResourceTableColumn<AccountUser, "email" | "role">[] = [
		{
			key: "email",
			label: "Email",
			render: (user) => user.email,
			compare: (a, b) => a.email.localeCompare(b.email),
		},
		{
			key: "role",
			label: "Role",
			render: (user) => (
				<>
					{user.role}
					{user.mustChangePassword ? " · password change required" : ""}
				</>
			),
			compare: (a, b) => a.role.localeCompare(b.role),
		},
	];
	const rows = users
		.filter((user) =>
			`${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()),
		)
		.sort(
			(a, b) =>
				(sort === "email"
					? a.email.localeCompare(b.email)
					: a.role.localeCompare(b.role)) * (direction === "asc" ? 1 : -1),
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
					onSaved={(saved) =>
						setUsers((users) =>
							form.mode === "create"
								? [...users, saved]
								: users.map((user) => (user.id === saved.id ? saved : user)),
						)
					}
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
