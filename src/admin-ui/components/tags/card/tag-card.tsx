import { useRef, useState } from "react";
import type { TagsAdminRow } from "../../../loaders/tags.js";
import { Tag } from "../../shared/resource-views/index.js";
import styles from "./tag-card.module.css";

type Props = {
	tag: TagsAdminRow;
	onEdit: (tag: TagsAdminRow) => void;
	onColorSave: (tag: TagsAdminRow, color: string) => Promise<void>;
};

/** Owns the temporary color preview; the page owns persisted Tag data. */
export const TagCard = ({ tag, onEdit, onColorSave }: Props) => {
	const [draftColor, setDraftColor] = useState(tag.color);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string>();
	const savingRef = useRef(false);
	const colorRef = useRef<HTMLInputElement>(null);
	const hasChanges = draftColor.toLowerCase() !== tag.color.toLowerCase();
	const cancel = () => {
		if (savingRef.current) return;
		setDraftColor(tag.color);
		setError(undefined);
		colorRef.current?.focus();
	};
	const save = async () => {
		if (savingRef.current || !hasChanges) return;
		savingRef.current = true;
		setIsSaving(true);
		setError(undefined);
		try {
			await onColorSave(tag, draftColor);
			window.requestAnimationFrame(() => colorRef.current?.focus());
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: "Tag color could not be saved.",
			);
		} finally {
			savingRef.current = false;
			setIsSaving(false);
		}
	};
	return (
		<article
			className={styles.card}
			aria-label={`Tag ${tag.title}`}
			aria-busy={isSaving}
		>
			<div className={styles.row}>
				<div className={styles.preview}>
					<Tag as="span" size="large" color={draftColor}>
						{tag.title}
					</Tag>
				</div>
				<div className={styles.controls}>
					<input
						ref={colorRef}
						type="color"
						value={draftColor}
						className={styles.swatch}
						aria-label={`Choose color for ${tag.title}`}
						disabled={isSaving}
						onChange={(event) => {
							setDraftColor(event.target.value);
							setError(undefined);
						}}
					/>
					<div className={styles.actions}>
						{hasChanges ? (
							<>
								<button
									type="button"
									aria-label={`Cancel color change for ${tag.title}`}
									title="Cancel color change"
									disabled={isSaving}
									onClick={cancel}
								>
									<svg
										viewBox="0 0 24 24"
										width="20"
										height="20"
										aria-hidden="true"
									>
										<path d="m6 6 12 12M18 6 6 18" />
									</svg>
								</button>
								<button
									type="button"
									aria-label={`Save color for ${tag.title}`}
									title="Save color"
									disabled={isSaving}
									onClick={save}
								>
									{isSaving ? (
										"…"
									) : (
										<svg
											viewBox="0 0 24 24"
											width="20"
											height="20"
											aria-hidden="true"
										>
											<path d="m5 12 4 4 10-10" />
										</svg>
									)}
								</button>
							</>
						) : (
							<button
								type="button"
								aria-label={`Edit ${tag.title}`}
								disabled={isSaving}
								onClick={() => onEdit(tag)}
							>
								Edit
							</button>
						)}
					</div>
				</div>
			</div>
			{error !== undefined && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
		</article>
	);
};

/** Uses the same card-renderer interface as Shows and DJs. */
export const renderTagCard = (
	tag: TagsAdminRow,
	key: string | number,
	onEdit: Props["onEdit"],
	onColorSave: Props["onColorSave"],
) => <TagCard key={key} tag={tag} onEdit={onEdit} onColorSave={onColorSave} />;
