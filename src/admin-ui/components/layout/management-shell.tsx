import { type ReactNode, useState } from "react";
import type { AccountUser } from "../../loaders/auth.js";
import { ChangePasswordModal } from "../auth/index.js";
import styles from "./management-shell.module.css";

type ManagementShellProps = {
	activeResource: "shows" | "djs" | "tags" | "mixcloud" | "users";
	children: ReactNode;
	user?: AccountUser;
	onLogout?: () => Promise<void>;
};

export const ManagementShell = ({
	activeResource,
	children,
	user,
	onLogout,
}: ManagementShellProps) => {
	const [changing, setChanging] = useState(false);
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	return (
		<div className={styles.layout}>
			<header className={styles.header} inert={changing}>
				OTHER DESERT RADIO / MANAGEMENT
			</header>
			<aside
				className={styles.sidebar}
				aria-label="Admin navigation"
				inert={changing}
			>
				<nav>
					<p>DATABASE</p>
					<ul>
						<li>
							<a
								className={
									activeResource === "shows" ? styles.active : undefined
								}
								href="#shows"
								aria-current={activeResource === "shows" ? "page" : undefined}
							>
								⤷ shows
							</a>
						</li>
						<li>
							<a
								className={activeResource === "djs" ? styles.active : undefined}
								href="#djs"
								aria-current={activeResource === "djs" ? "page" : undefined}
							>
								⤷ DJs
							</a>
						</li>
						<li>
							<a
								className={
									activeResource === "tags" ? styles.active : undefined
								}
								href="#tags"
								aria-current={activeResource === "tags" ? "page" : undefined}
							>
								⤷ tags
							</a>
						</li>
						<li>
							<a
								className={
									activeResource === "mixcloud" ? styles.active : undefined
								}
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
									className={
										activeResource === "users" ? styles.active : undefined
									}
									aria-current={activeResource === "users" ? "page" : undefined}
								>
									⤷ users
								</a>
							</li>
						)}
					</ul>
					{user && (
						<div className={styles.account}>
							<span>{user.email}</span>
							<button type="button" onClick={() => setChanging(true)}>
								Change password
							</button>
							<button
								type="button"
								disabled={pending}
								onClick={async () => {
									setPending(true);
									setError(undefined);
									try {
										await onLogout?.();
									} catch {
										setError("Unable to sign out. Try again.");
									} finally {
										setPending(false);
									}
								}}
							>
								{pending ? "Signing out…" : "Sign out"}
							</button>
							{error && <p role="alert">{error}</p>}
						</div>
					)}
				</nav>
			</aside>
			<section className={styles.content} inert={changing}>
				{children}
			</section>
			{changing && <ChangePasswordModal onClose={() => setChanging(false)} />}
		</div>
	);
};
