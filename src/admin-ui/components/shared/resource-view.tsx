import type { ReactNode } from "react";
import styles from "./resource-view.module.css";

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
	<section className={styles.view}>
		{isLoading && <p className={styles.status}>Loading {title}…</p>}
		{error !== undefined && (
			<div className={`${styles.message} ${styles.error}`} role="alert">
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
					<div className={styles.empty}>
						<p>{emptyMessage}</p>
					</div>
				) : hasNoResults ? (
					<div className={styles.empty}>
						<p>{noResultsMessage}</p>
					</div>
				) : (
					children
				)}
			</>
		)}
	</section>
);
