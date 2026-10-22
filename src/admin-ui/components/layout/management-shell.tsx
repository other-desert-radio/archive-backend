import { type ReactNode, useRef, useState } from "react";
import type { AccountUser } from "../../loaders/auth.js";
import { ChangePasswordModal } from "../auth/index.js";
import {
	PublicationControl,
	PublicationModal,
	usePublication,
} from "../publication/index.js";
import { MessageModal } from "../shared/modal/index.js";
import styles from "./management-shell.module.css";

type ManagementShellProps = {
	activeResource: "shows" | "djs" | "tags" | "mixcloud" | "users" | "upload";
	children: ReactNode;
	user?: AccountUser;
	onLogout?: () => Promise<void>;
};

type AccountDialogProps = {
	email: AccountUser["email"];
	onDismiss: () => void;
	onChangePassword: () => void;
	onLogout: ManagementShellProps["onLogout"];
};

/** Owns the signed-in dialog and sign-out request feedback. */
const AccountDialog = ({
	email,
	onDismiss,
	onChangePassword,
	onLogout,
}: AccountDialogProps) => {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string>();
	const dismiss = () => {
		if (!pending) onDismiss();
	};
	return (
		<MessageModal
			title="Signed In"
			message={email}
			panelClassName={styles.accountPanel}
			showCloseButton
			onDismiss={dismiss}
			initialFocus="primary"
			primaryAction={{
				label: "Change password",
				disabled: pending,
				onClick: onChangePassword,
			}}
			secondaryAction={{
				label: pending ? "Signing out…" : "Sign out",
				disabled: pending || !onLogout,
				onClick: async () => {
					if (pending || !onLogout) return;
					setPending(true);
					setError(undefined);
					try {
						await onLogout();
					} catch {
						setError("Unable to sign out. Try again.");
					} finally {
						setPending(false);
					}
				},
			}}
		>
			{error && <p role="alert">{error}</p>}
		</MessageModal>
	);
};

const styleWhenActive = (
	activeResource: ManagementShellProps["activeResource"],
	resource: ManagementShellProps["activeResource"],
) => (activeResource === resource ? styles.active : undefined);

export const ManagementShell = ({
	activeResource,
	children,
	user,
	onLogout,
}: ManagementShellProps) => {
	const publication = usePublication(user?.role === "admin");
	const [publishing, setPublishing] = useState(false);
	const [changing, setChanging] = useState(false);
	const [accountOpen, setAccountOpen] = useState(false);
	const accountButton = useRef<HTMLButtonElement>(null);
	const restoreAccountFocus = () => {
		requestAnimationFrame(() => accountButton.current?.focus());
	};
	const blocked = changing || publishing || accountOpen;
	return (
		<div className={styles.layout}>
			<header className={styles.header} inert={blocked}>
				<span className={styles.headerTitle}>
					OTHER DESERT RADIO / MANAGEMENT
				</span>
				{user?.role === "admin" && (
					<PublicationControl
						publication={publication}
						onOpen={() => setPublishing(true)}
					/>
				)}
				{user && (
					<button
						type="button"
						ref={accountButton}
						className={styles.accountButton}
						aria-label="Account"
						aria-haspopup="dialog"
						aria-expanded={accountOpen}
						onClick={() => setAccountOpen(true)}
					>
						<span aria-hidden="true">🩐</span>
					</button>
				)}
			</header>
			<aside
				className={styles.sidebar}
				aria-label="Admin navigation"
				inert={blocked}
			>
				<nav>
					<p>DATABASE</p>
					<ul>
						<li>
							<a
								className={styleWhenActive(activeResource, "shows")}
								href="#shows"
								aria-current={activeResource === "shows" ? "page" : undefined}
							>
								⤷ shows
							</a>
						</li>
						<li>
							<a
								className={styleWhenActive(activeResource, "djs")}
								href="#djs"
								aria-current={activeResource === "djs" ? "page" : undefined}
							>
								⤷ DJs
							</a>
						</li>
						<li>
							<a
								className={styleWhenActive(activeResource, "tags")}
								href="#tags"
								aria-current={activeResource === "tags" ? "page" : undefined}
							>
								⤷ tags
							</a>
						</li>
						<li>
							<a
								className={styleWhenActive(activeResource, "mixcloud")}
								href="#mixcloud"
								aria-current={
									activeResource === "mixcloud" ? "page" : undefined
								}
							>
								⤷{" "}
								<span className={styles.multilineLabel}>
									mixcloud
									<br />
									import
								</span>
							</a>
						</li>
						{user?.role === "admin" && (
							<li>
								<a
									href="#users"
									className={styleWhenActive(activeResource, "users")}
									aria-current={activeResource === "users" ? "page" : undefined}
								>
									⤷ users
								</a>
							</li>
						)}
					</ul>
					<p className={styles.navigationSection}>UTILS</p>
					<ul>
						<li>
							<a
								href="#upload"
								className={styleWhenActive(activeResource, "upload")}
								aria-current={activeResource === "upload" ? "page" : undefined}
							>
								⤷ upload
							</a>
						</li>
					</ul>
				</nav>
			</aside>
			<section className={styles.content} inert={blocked}>
				{children}
			</section>
			{publishing && (
				<PublicationModal
					publication={publication}
					onClose={() => setPublishing(false)}
				/>
			)}
			{changing && (
				<ChangePasswordModal
					onClose={() => {
						setChanging(false);
						restoreAccountFocus();
					}}
				/>
			)}
			{user && accountOpen && (
				<AccountDialog
					email={user.email}
					onDismiss={() => {
						setAccountOpen(false);
						restoreAccountFocus();
					}}
					onChangePassword={() => {
						setAccountOpen(false);
						setChanging(true);
					}}
					onLogout={onLogout}
				/>
			)}
		</div>
	);
};
