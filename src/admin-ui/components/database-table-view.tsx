import type { ReactNode } from "react";

type DatabaseTableViewProps = {
	title: string;
	isLoading: boolean;
	error?: unknown;
	onRetry: () => void;
	isEmpty: boolean;
	emptyMessage: string;
	children: ReactNode;
};

export const Header = ({ title }: { title: string }) => (
	<header className="database-table-header">
		<p className="eyebrow">Archive</p>
		<h1>{title}</h1>
	</header>
);

export const Body = ({ children }: { children: ReactNode }) => (
	<div className="database-table-body">{children}</div>
);

export const getDatabaseTableViewError = (title: string) =>
	`The ${title} could not be loaded.`;

export const DatabaseTableView = ({
	title,
	isLoading,
	error,
	onRetry,
	isEmpty,
	emptyMessage,
	children,
}: DatabaseTableViewProps) => (
	<section className="database-table-view">
		<Header title={title} />
		<Body>
			{isLoading && <p className="status">Loading {title}…</p>}
			{error !== undefined && (
				<div className="message error" role="alert">
					<p>{getDatabaseTableViewError(title)}</p>
					<button type="button" onClick={onRetry}>
						Try again
					</button>
				</div>
			)}
			{!isLoading && error === undefined && isEmpty && (
				<p className="status">{emptyMessage}</p>
			)}
			{!isLoading && error === undefined && !isEmpty && children}
		</Body>
	</section>
);
