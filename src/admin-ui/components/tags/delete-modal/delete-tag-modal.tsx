import { useCallback, useEffect, useRef, useState } from "react";
import type { TagDeleteImpact } from "../../../../admin/routes/tags/index.js";
import { loadTagDeleteImpact, removeTag } from "../../../loaders/remove-tag.js";
import type { TagsAdminRow } from "../../../loaders/tags.js";
import { MessageModal } from "../../shared/modal/index.js";
import styles from "./delete-tag-modal.module.css";

type Props = {
	tag: TagsAdminRow;
	onClose: () => void;
	onDeleted: (id: number) => void;
};
const assignmentLabels = {
	direct: "direct",
	inherited: "inherited through Shows",
	both: "direct and inherited through Shows",
};

/** Loads affected resources before allowing permanent tag deletion. */
export const DeleteTagModal = ({ tag, onClose, onDeleted }: Props) => {
	const [impact, setImpact] = useState<TagDeleteImpact>();
	const [loadError, setLoadError] = useState<string>();
	const [deleteError, setDeleteError] = useState<string>();
	const loadVersion = useRef(0);
	const [pending, setPending] = useState(false);
	const submitting = useRef(false);
	const refreshImpact = useCallback(() => {
		const version = ++loadVersion.current;
		setImpact(undefined);
		setLoadError(undefined);
		loadTagDeleteImpact(tag.id)
			.then((result) => {
				if (version === loadVersion.current) setImpact(result);
			})
			.catch((error: unknown) => {
				if (version === loadVersion.current)
					setLoadError(
						error instanceof Error
							? error.message
							: "Tag impact could not be loaded. Please retry.",
					);
			});
	}, [tag.id]);
	useEffect(() => {
		refreshImpact();
		return () => {
			loadVersion.current += 1;
		};
	}, [refreshImpact]);
	const dismiss = () => {
		if (!submitting.current) onClose();
	};
	const confirm = async () => {
		if (submitting.current || impact === undefined) return;
		submitting.current = true;
		setPending(true);
		setDeleteError(undefined);
		try {
			await removeTag({ id: tag.id });
			onDeleted(tag.id);
		} catch (error) {
			setDeleteError(
				error instanceof Error
					? error.message
					: "Tag could not be deleted. Please retry.",
			);
		} finally {
			submitting.current = false;
			setPending(false);
		}
	};
	return (
		<MessageModal
			title="Delete Tag?"
			message={`Permanently delete “${impact?.tag.title ?? tag.title}”? This removes its assignments from Shows and DJs. The Shows and DJs will be kept. This cannot be undone.`}
			role="alertdialog"
			initialFocus="secondary"
			restoreFocus
			onDismiss={dismiss}
			secondaryAction={{ label: "Cancel", onClick: dismiss, disabled: pending }}
			primaryAction={{
				label: pending ? "Deleting…" : "Delete",
				onClick: () => {
					void confirm();
				},
				disabled: pending || impact === undefined,
				destructive: true,
			}}
		>
			{impact === undefined && loadError === undefined && (
				<p role="status">Loading affected Shows and DJs…</p>
			)}
			{loadError && (
				<div className={styles.error}>
					<p role="alert">{loadError}</p>
					<button type="button" onClick={refreshImpact}>
						Retry
					</button>
				</div>
			)}
			{impact && (
				<div className={styles.impact}>
					<section aria-label="Affected Shows">
						<h3>Shows ({impact.shows.length})</h3>
						{impact.shows.length === 0 ? (
							<p>No Shows affected</p>
						) : (
							<ul>
								{impact.shows.map((show) => (
									<li key={show.id}>
										{show.title} (#{show.id})
									</li>
								))}
							</ul>
						)}
					</section>
					<section aria-label="Affected DJs">
						<h3>DJs ({impact.djs.length})</h3>
						{impact.djs.length === 0 ? (
							<p>No DJs affected</p>
						) : (
							<ul>
								{impact.djs.map((dj) => (
									<li key={dj.id}>
										{dj.title} (#{dj.id}) — {assignmentLabels[dj.assignment]}
									</li>
								))}
							</ul>
						)}
					</section>
					<p className={styles.note}>Assignments may change before deletion.</p>
				</div>
			)}
			{deleteError && (
				<p role="alert" className={styles.error}>
					{deleteError}
				</p>
			)}
		</MessageModal>
	);
};
