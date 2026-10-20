import {
	type FormEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	type AccountUser,
	authRequest,
	loadSession,
} from "../../../loaders/auth.js";
import {
	LabeledFormControl,
	OnboardingModal,
} from "../../shared/modal/index.js";
import styles from "./account-access.module.css";

export const PasswordFields = ({
	current,
	password,
	confirm,
	onCurrent,
	onPassword,
	onConfirm,
}: {
	current?: string;
	password: string;
	confirm: string;
	onCurrent?: (value: string) => void;
	onPassword: (value: string) => void;
	onConfirm: (value: string) => void;
}) => (
	<>
		{onCurrent && (
			<LabeledFormControl
				id="current-password"
				name="currentPassword"
				label="current password"
				type="password"
				autoComplete="current-password"
				required
				value={current ?? ""}
				onChange={onCurrent}
			/>
		)}
		<LabeledFormControl
			id="new-password"
			name="newPassword"
			label="new password"
			type="password"
			autoComplete="new-password"
			minLength={8}
			maxLength={128}
			required
			helper="8–128 characters"
			value={password}
			onChange={onPassword}
		/>
		<LabeledFormControl
			id="confirm-password"
			name="confirmPassword"
			label="confirm password"
			type="password"
			autoComplete="new-password"
			required
			value={confirm}
			onChange={onConfirm}
			{...(confirm !== "" && confirm !== password
				? { error: "Passwords must match" }
				: {})}
		/>
	</>
);

export const ChangePasswordModal = ({ onClose }: { onClose: () => void }) => {
	const [current, setCurrent] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	return (
		<OnboardingModal
			isOpen
			title="Change password"
			cancelLabel="Cancel"
			submitLabel="Save password"
			onClose={onClose}
			hasUnsavedChanges={current !== "" || password !== "" || confirm !== ""}
			isSubmitDisabled={
				password.length < 8 ||
				password.length > 128 ||
				password !== confirm ||
				!current
			}
			onSubmit={async () => {
				await authRequest("/api/account/change-password", {
					currentPassword: current,
					newPassword: password,
				});
			}}
		>
			<PasswordFields
				current={current}
				password={password}
				confirm={confirm}
				onCurrent={setCurrent}
				onPassword={setPassword}
				onConfirm={setConfirm}
			/>
		</OnboardingModal>
	);
};

export const AccountAccess = ({
	children,
}: {
	children: (user: AccountUser, logout: () => Promise<void>) => ReactNode;
}) => {
	const panelRef = useRef<HTMLElement>(null);
	const [sessionError, setSessionError] = useState(false);
	const [user, setUser] = useState<AccountUser>();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [current, setCurrent] = useState("");
	const [confirm, setConfirm] = useState("");
	const [pending, setPending] = useState(false);
	const refresh = useCallback(async () => {
		setLoading(true);
		setSessionError(false);
		setError(undefined);
		try {
			setUser(await loadSession());
		} catch (error: unknown) {
			setSessionError(true);
			setError(
				error instanceof Error
					? error.message
					: "Unable to check your session. Retry; if this continues, contact the administrator.",
			);
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void refresh();
		const expired = () => {
			setUser(undefined);
			setPassword("");
			setCurrent("");
			setConfirm("");
		};
		const required = () => {
			setPassword("");
			setCurrent("");
			setConfirm("");
			void refresh();
		};
		window.addEventListener("auth:expired", expired);
		window.addEventListener("auth:password-required", required);
		return () => {
			window.removeEventListener("auth:expired", expired);
			window.removeEventListener("auth:password-required", required);
		};
	}, [refresh]);
	useEffect(() => {
		if (!loading && (!user || user.mustChangePassword))
			panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
	}, [loading, user]);
	const logout = async () => {
		await authRequest("/api/auth/sign-out", {});
		setUser(undefined);
		setPassword("");
		setCurrent("");
		setConfirm("");
	};
	if (loading)
		return (
			<main className={styles.screen}>
				<p role="status">Checking session…</p>
			</main>
		);
	if (sessionError)
		return (
			<main className={styles.screen}>
				<section className={styles.panel}>
					<p role="alert">{error}</p>
					<button
						type="button"
						className={styles.secondary}
						onClick={() => {
							void refresh();
						}}
					>
						Retry
					</button>
				</section>
			</main>
		);
	if (user && !user.mustChangePassword) return children(user, logout);
	const required = Boolean(user?.mustChangePassword);
	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (pending) return;
		setPending(true);
		setError(undefined);
		try {
			if (required) {
				if (password !== confirm) throw new Error("Passwords must match");
				await authRequest("/api/account/change-password", {
					currentPassword: current,
					newPassword: password,
				});
			} else {
				await authRequest("/api/auth/sign-in/email", { email, password });
			}
			setPassword("");
			setCurrent("");
			setConfirm("");
			await refresh();
		} catch (error) {
			setError(
				!required
					? "Unable to sign in. Check your email and password and try again."
					: error instanceof Error
						? error.message
						: "Unable to sign in. Please try again.",
			);
		} finally {
			setPending(false);
		}
	};
	return (
		<main className={styles.screen}>
			<section className={styles.panel} ref={panelRef}>
				<h1>{required ? "Change your password" : "Sign in"}</h1>
				{required && <p>Choose a new password before continuing.</p>}
				<form onSubmit={submit}>
					<fieldset disabled={pending} className={styles.fields}>
						{required ? (
							<PasswordFields
								current={current}
								password={password}
								confirm={confirm}
								onCurrent={setCurrent}
								onPassword={setPassword}
								onConfirm={setConfirm}
							/>
						) : (
							<>
								<LabeledFormControl
									id="login-email"
									name="email"
									label="email"
									type="email"
									autoComplete="username"
									required
									value={email}
									onChange={setEmail}
								/>
								<LabeledFormControl
									id="login-password"
									name="password"
									label="password"
									type="password"
									autoComplete="current-password"
									required
									value={password}
									onChange={setPassword}
								/>
							</>
						)}
						{error && (
							<p role="alert" className={styles.error}>
								{error}
							</p>
						)}
						<button
							type="submit"
							className={styles.submit}
							disabled={
								pending ||
								(required &&
									(password.length < 8 ||
										password.length > 128 ||
										password !== confirm))
							}
						>
							{pending
								? "Please wait…"
								: required
									? "Save password"
									: "Sign in"}
						</button>
					</fieldset>
				</form>
				{required && (
					<button
						type="button"
						className={styles.secondary}
						disabled={pending}
						onClick={() => {
							void logout().catch(() =>
								setError("Unable to sign out. Please try again."),
							);
						}}
					>
						Sign out
					</button>
				)}
			</section>
		</main>
	);
};
