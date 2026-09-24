import type { ReactNode } from "react";

type ResourceViewProps = {
	title: string;
	isLoading: boolean;
	error?: unknown;
	onRetry: () => void;
	isEmpty: boolean;
	emptyMessage: string;
	noResultsMessage?: string;
	hasNoResults?: boolean;
	toolbar: ReactNode;
	children: ReactNode;
};

/** Shares the load, retry, empty, and no-results states used by resource views. */
export const ResourceView = ({
	title,
	isLoading,
	error,
	onRetry,
	isEmpty,
	emptyMessage,
	noResultsMessage,
	hasNoResults = false,
	toolbar,
	children,
}: ResourceViewProps) => (
	<section className="resource-view">
		{isLoading && <p className="status">Loading {title}…</p>}
		{error !== undefined && (
			<div className="message error" role="alert">
				<p>The {title} could not be loaded.</p>
				<button type="button" onClick={onRetry}>
					Try again
				</button>
			</div>
		)}
		{!isLoading && error === undefined && (
			<>
				{toolbar}
				{isEmpty ? (
					<div className="resource-table-wrapper empty-table">
						<p>{emptyMessage}</p>
					</div>
				) : hasNoResults ? (
					<div className="resource-table-wrapper empty-table">
						<p>{noResultsMessage}</p>
					</div>
				) : (
					children
				)}
			</>
		)}
	</section>
);
