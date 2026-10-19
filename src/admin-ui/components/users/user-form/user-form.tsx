import { useState } from "react";
import { type AccountUser, authRequest } from "../../../loaders/auth.js";
import { PasswordFields } from "../../auth/index.js";
import {
	LabeledFormControl,
	OnboardingModal,
} from "../../shared/modal/index.js";
import styles from "./user-form.module.css";
export type UserFormMode = "create" | "role" | "reset";
export const UserForm = ({
	mode,
	user,
	onClose,
	onSaved,
}: {
	mode: UserFormMode;
	user?: AccountUser;
	onClose: () => void;
	onSaved: (user: AccountUser) => void;
}) => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [role, setRole] = useState<AccountUser["role"]>(user?.role ?? "editor");
	const needsPassword = mode !== "role";
	return (
		<OnboardingModal
			isOpen
			title={
				mode === "create"
					? "Create account"
					: mode === "role"
						? "Change role"
						: "Reset password"
			}
			cancelLabel="Cancel"
			submitLabel={mode === "create" ? "Create account" : "Save"}
			onClose={onClose}
			hasUnsavedChanges={
				email !== "" ||
				password !== "" ||
				confirm !== "" ||
				role !== (user?.role ?? "editor")
			}
			isSubmitDisabled={
				needsPassword &&
				(password.length < 8 || password.length > 128 || password !== confirm)
			}
			onSubmit={async () => {
				const saved = await authRequest<AccountUser>(
					`/api/admin/${mode === "create" ? "create-user" : mode === "role" ? "modify-user-role" : "reset-user-password"}`,
					mode === "create"
						? { email, password, role }
						: mode === "role"
							? { id: user?.id, role }
							: { id: user?.id, password },
				);
				onSaved(saved);
			}}
		>
			{mode === "create" ? (
				<LabeledFormControl
					id="account-email"
					name="email"
					label="email"
					type="email"
					autoComplete="off"
					required
					value={email}
					onChange={setEmail}
				/>
			) : (
				<p className={styles.information}>{user?.email}</p>
			)}
			{mode !== "reset" && (
				<>
					<label htmlFor="account-role">role</label>
					<select
						className={styles.role}
						id="account-role"
						value={role}
						onChange={(event) =>
							setRole(event.target.value === "admin" ? "admin" : "editor")
						}
					>
						<option value="editor">Editor</option>
						<option value="admin">Admin</option>
					</select>
				</>
			)}
			{needsPassword && (
				<>
					<PasswordFields
						password={password}
						confirm={confirm}
						onPassword={setPassword}
						onConfirm={setConfirm}
					/>
					<p className={styles.information}>
						The account must choose a new password at its next sign-in. Share
						the temporary password securely.
					</p>
				</>
			)}
		</OnboardingModal>
	);
};
