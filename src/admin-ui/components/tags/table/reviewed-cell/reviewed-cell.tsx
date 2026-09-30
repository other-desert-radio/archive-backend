import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { ModifyTagReviewRequest } from "../../../../../admin/routes/tags/index.js";
import type { TagsAdminRow } from "../../../../loaders/tags.js";
import styles from "./reviewed-cell.module.css";

type Props = {
	tag: TagsAdminRow;
	onSave: (request: ModifyTagReviewRequest) => Promise<void>;
};
/** Saves the review answer directly without replacing Tag metadata. */
export const ReviewedCell = ({ tag, onSave }: Props) => {
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string>();
	const savingRef = useRef(false);
	const editRef = useRef<HTMLButtonElement>(null);
	const controlsRef = useRef<HTMLDivElement>(null);
	const wasEditing = useRef(false);
	useEffect(() => {
		if (isEditing)
			controlsRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
		else if (wasEditing.current) editRef.current?.focus();
		wasEditing.current = isEditing;
	}, [isEditing]);
	const save = async (reviewed: boolean) => {
		if (savingRef.current) return;
		savingRef.current = true;
		setIsSaving(true);
		setError(undefined);
		try {
			await onSave({ edit_type: "review", id: tag.id, reviewed });
			setIsEditing(false);
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: "Review status could not be saved",
			);
		} finally {
			savingRef.current = false;
			setIsSaving(false);
		}
	};
	const dismissOnEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== "Escape" || savingRef.current) return;
		setIsEditing(false);
		setError(undefined);
	};
	return (
		<div className={styles.cell} aria-busy={isSaving}>
			{isEditing ? (
				<div ref={controlsRef} className={styles.controls}>
					<span>reviewed?</span>
					<button
						type="button"
						className={styles.icon}
						aria-label={`Mark ${tag.title} reviewed`}
						title="Reviewed"
						disabled={isSaving}
						onKeyDown={dismissOnEscape}
						onClick={() => save(true)}
					>
						{isSaving ? (
							"…"
						) : (
							<svg
								viewBox="0 0 24 24"
								width="18"
								height="18"
								aria-hidden="true"
							>
								<path d="m5 12 4 4 10-10" />
							</svg>
						)}
					</button>
					<button
						type="button"
						className={styles.icon}
						aria-label={`Mark ${tag.title} unreviewed`}
						title="Not reviewed"
						disabled={isSaving}
						onKeyDown={dismissOnEscape}
						onClick={() => save(false)}
					>
						<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
							<path d="m6 6 12 12M18 6 6 18" />
						</svg>
					</button>
				</div>
			) : (
				<div className={styles.value}>
					<span>{String(tag.reviewed)}</span>
					<button
						ref={editRef}
						type="button"
						className={`${styles.edit} ${tag.reviewed ? styles.reviewed : ""}`}
						aria-label={`Review tag ${tag.title}`}
						onClick={() => {
							setError(undefined);
							setIsEditing(true);
						}}
					>
						Review
					</button>
				</div>
			)}
			{error !== undefined && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
		</div>
	);
};
