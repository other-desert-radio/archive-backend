import type { ReactNode } from "react";
import styles from "./resource-view.module.css";

type ResourceViewProps = {
	title: string;
	afterTitle?: ReactNode;
	isLoading: boolean;
	error?: unknown;
	onRetry: () => void;
	isEmpty: boolean;
	emptyMessage: string;
	noResultsMessage?: string;
	hasNoResults?: boolean;
	toolbar?: ReactNode;
	banner?: ReactNode;
	children: ReactNode;
};

/** Shares the load, retry, empty, and no-results states used by resource views. */
export const ResourceView = ({
	title,
	afterTitle,
	isLoading,
	error,
	onRetry,
	isEmpty,
	emptyMessage,
	noResultsMessage,
	hasNoResults = false,
	toolbar,
	banner,
	children,
}: ResourceViewProps) => (
	<section className={styles.view}>
		<header className={styles.header}>
			<h1>{title}</h1>
		</header>
		{afterTitle}
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
				{banner != null && <div className={styles.banner}>{banner}</div>}
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
