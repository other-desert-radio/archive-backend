import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { SegmentedPicker } from "../segmented-picker/index.js";

export type ResourceViewMode = "grid" | "table";

type ResourceToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	viewMode?: ResourceViewMode;
	onViewModeChange?: (viewMode: ResourceViewMode) => void;
	showViewControls?: boolean;
	searchLabel: string;
	createLabel?: string;
	createTitle?: string;
	onCreate?: () => void;
	createDisabled?: boolean;
	actionsBeforeCreate?: ReactNode;
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
	createTitle,
	onCreate,
	createDisabled = false,
	actionsBeforeCreate,
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
							<SegmentedPicker<ResourceViewMode>
								label="View mode"
								value={viewMode}
								options={[
									{ value: "grid", label: "grid" },
									{ value: "table", label: "table" },
								]}
								onChange={onViewModeChange}
							/>
						)}
					{actionsBeforeCreate}
					{onCreate !== undefined && createLabel !== undefined && (
						<button
							type="button"
							className={styles.add}
							title={createTitle}
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
