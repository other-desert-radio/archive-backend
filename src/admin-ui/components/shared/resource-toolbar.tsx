type ResourceToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	searchLabel: string;
	createLabel: string;
	onCreate: () => void;
	createDisabled?: boolean;
};

import styles from "./resource-toolbar.module.css";

/** Renders the common resource search, view controls, and create action. */
export const ResourceToolbar = ({
	query,
	onQueryChange,
	searchLabel,
	createLabel,
	onCreate,
	createDisabled = false,
}: ResourceToolbarProps) => (
	<div className={styles.toolbar}>
		<input
			aria-label={searchLabel}
			placeholder="search..."
			value={query}
			onChange={(event) => onQueryChange(event.target.value)}
		/>
		<div className={styles.actions}>
			<fieldset className={styles.switcher}>
				<button type="button" disabled>
					grid
				</button>
				<button type="button" className={styles.selected} aria-pressed="true">
					table
				</button>
			</fieldset>
			<button
				type="button"
				className={styles.add}
				onClick={onCreate}
				disabled={createDisabled}
			>
				{createLabel}
			</button>
		</div>
	</div>
);
