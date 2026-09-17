type DJToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	onAddDJ: () => void;
};

/** Renders the DJ search, view switcher, and onboarding action controls. */
export const DJToolbar = ({
	query,
	onQueryChange,
	onAddDJ,
}: DJToolbarProps) => (
	<div className="dj-toolbar g8">
		<input
			aria-label="Search DJs"
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
			<button type="button" className="add-dj-button" onClick={onAddDJ}>
				+ DJ
			</button>
		</div>
	</div>
);
