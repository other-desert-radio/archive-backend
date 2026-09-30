import type { ReactNode } from "react";
import styles from "./management-shell.module.css";

type ManagementShellProps = {
	activeResource: "shows" | "djs" | "tags" | "mixcloud";
	children: ReactNode;
};

export const ManagementShell = ({
	activeResource,
	children,
}: ManagementShellProps) => (
	<div className={styles.layout}>
		<header className={styles.header}>OTHER DESERT RADIO / MANAGEMENT</header>
		<aside className={styles.sidebar} aria-label="Admin navigation">
			<nav>
				<p>DATABASE</p>
				<ul>
					<li>
						<a
							className={activeResource === "shows" ? styles.active : undefined}
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
							className={activeResource === "tags" ? styles.active : undefined}
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
							aria-current={activeResource === "mixcloud" ? "page" : undefined}
						>
							⤷{" "}
							<span className={styles.multilineLabel}>
								mixcloud
								<br />
								import
							</span>
						</a>
					</li>
				</ul>
			</nav>
		</aside>
		<section className={styles.content}>{children}</section>
	</div>
);
