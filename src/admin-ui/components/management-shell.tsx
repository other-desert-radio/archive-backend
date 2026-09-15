import type { ReactNode } from "react";

type ManagementShellProps = {
	activeResource: "shows" | "djs" | "tags";
	children: ReactNode;
};

export const ManagementShell = ({
	activeResource,
	children,
}: ManagementShellProps) => (
	<div className="management-layout">
		<header className="management-header">
			OTHER DESERT RADIO / MANAGEMENT
		</header>
		<aside className="management-sidebar" aria-label="Admin navigation">
			<nav>
				<p>DATABASE</p>
				<ul>
					<li>
						<a
							className={activeResource === "shows" ? "active" : undefined}
							href="#shows"
							aria-current={activeResource === "shows" ? "page" : undefined}
						>
							- shows
						</a>
					</li>
					<li>
						<a
							className={activeResource === "djs" ? "active" : undefined}
							href="#djs"
							aria-current={activeResource === "djs" ? "page" : undefined}
						>
							- DJs
						</a>
					</li>
					<li>
						<a
							className={activeResource === "tags" ? "active" : undefined}
							href="#tags"
							aria-current={activeResource === "tags" ? "page" : undefined}
						>
							- tags
						</a>
					</li>
				</ul>
				<p>UTILS</p>
				<ul>
					<li>- upload</li>
				</ul>
			</nav>
		</aside>
		<section
			className={`management-content${
				activeResource === "djs" ? " dj-management-content" : ""
			}`}
		>
			{children}
		</section>
	</div>
);
