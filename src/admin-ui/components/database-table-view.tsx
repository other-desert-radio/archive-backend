import type { ReactNode } from "react";

export const Header = ({ title }: { title: string }) => (
	<header className="database-table-header">
		<p className="eyebrow">Archive</p>
		<h1>{title}</h1>
	</header>
);

export const Body = ({ children }: { children: ReactNode }) => (
	<div className="database-table-body">{children}</div>
);

export const DatabaseTableView = ({ children }: { children: ReactNode }) => (
	<section className="database-table-view">{children}</section>
);
