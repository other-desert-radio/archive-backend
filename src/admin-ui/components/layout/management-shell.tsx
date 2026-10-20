import { type ReactNode, useState } from "react";
import type { AccountUser } from "../../loaders/auth.js";
import { ChangePasswordModal } from "../auth/index.js";
import {
	PublicationControl,
	PublicationModal,
	usePublication,
} from "../publication/index.js";
import styles from "./management-shell.module.css";

type ManagementShellProps = {
	activeResource: "shows" | "djs" | "tags" | "mixcloud" | "users";
	children: ReactNode;
	user?: AccountUser;
	onLogout?: () => Promise<void>;
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
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	return (
		<div className={styles.layout}>
			<header className={styles.header} inert={changing || publishing}>
				<span className={styles.headerTitle}>
					OTHER DESERT RADIO / MANAGEMENT
				</span>
				{user?.role === "admin" && (
					<PublicationControl
						publication={publication}
						onOpen={() => setPublishing(true)}
					/>
				)}
			</header>
			<aside
				className={styles.sidebar}
				aria-label="Admin navigation"
				inert={changing || publishing}
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
			<section className={styles.content} inert={changing || publishing}>
				{children}
			</section>
			{publishing && (
				<PublicationModal
					publication={publication}
					onClose={() => setPublishing(false)}
				/>
			)}
			{changing && <ChangePasswordModal onClose={() => setChanging(false)} />}
		</div>
	);
};
