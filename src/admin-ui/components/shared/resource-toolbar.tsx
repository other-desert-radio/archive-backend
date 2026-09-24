type ResourceToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	searchLabel: string;
	createLabel: string;
	onCreate: () => void;
	createDisabled?: boolean;
};

/** Renders the common resource search, view controls, and create action. */
export const ResourceToolbar = ({
	query,
	onQueryChange,
	searchLabel,
	createLabel,
	onCreate,
	createDisabled = false,
}: ResourceToolbarProps) => (
	<div className="resource-toolbar g8">
		<input
			aria-label={searchLabel}
			placeholder="search..."
			value={query}
			onChange={(event) => onQueryChange(event.target.value)}
		/>
		<div className="flex">
			<fieldset className="view-switcher">
				<button type="button" disabled>
					grid
				</button>
				<button type="button" className="selected" aria-pressed="true">
					table
				</button>
			</fieldset>
			<button
				type="button"
				className="add-resource-button"
				onClick={onCreate}
				disabled={createDisabled}
			>
				{createLabel}
			</button>
		</div>
	</div>
);
