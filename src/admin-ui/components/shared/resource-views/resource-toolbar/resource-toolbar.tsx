import { useEffect, useRef, useState } from "react";

export type ResourceViewMode = "grid" | "table";

type ResourceToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	viewMode?: ResourceViewMode;
	onViewModeChange?: (viewMode: ResourceViewMode) => void;
	showViewControls?: boolean;
	searchLabel: string;
	createLabel?: string;
	onCreate?: () => void;
	createDisabled?: boolean;
};

import styles from "./resource-toolbar.module.css";

/** Renders the common resource search, view controls, and create action. */
export const ResourceToolbar = ({
	query,
	onQueryChange,
	viewMode,
	onViewModeChange,
	showViewControls = true,
	searchLabel,
	createLabel,
	onCreate,
	createDisabled = false,
}: ResourceToolbarProps) => {
	const sentinelRef = useRef<HTMLDivElement>(null);
	const toolbarRef = useRef<HTMLDivElement>(null);
	const [isStuck, setIsStuck] = useState(false);

	useEffect(() => {
		const update = () => {
			const sentinel = sentinelRef.current;
			const toolbar = toolbarRef.current;
			if (!sentinel || !toolbar) return;
			const offset = Number.parseFloat(getComputedStyle(toolbar).top);
			setIsStuck(sentinel.getBoundingClientRect().top <= offset);
		};
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, []);

	return (
		<>
			<div ref={sentinelRef} aria-hidden="true" />
			<div
				ref={toolbarRef}
				className={`${styles.toolbar} ${isStuck ? styles.stuck : ""}`}
			>
				<input
					aria-label={searchLabel}
					placeholder="search..."
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
				/>
				<div className={styles.actions}>
					{showViewControls &&
						viewMode !== undefined &&
						onViewModeChange !== undefined && (
							<fieldset className={styles.switcher}>
								<button
									type="button"
									className={viewMode === "grid" ? styles.selected : undefined}
									aria-pressed={viewMode === "grid"}
									onClick={() => onViewModeChange("grid")}
								>
									grid
								</button>
								<button
									type="button"
									className={viewMode === "table" ? styles.selected : undefined}
									aria-pressed={viewMode === "table"}
									onClick={() => onViewModeChange("table")}
								>
									table
								</button>
							</fieldset>
						)}
					{onCreate !== undefined && createLabel !== undefined && (
						<button
							type="button"
							className={styles.add}
							onClick={onCreate}
							disabled={createDisabled}
						>
							{createLabel}
						</button>
					)}
				</div>
			</div>
		</>
	);
};
