import { useCallback, useEffect, useRef, useState } from "react";
import type { DJDeleteImpact } from "../../../../admin/routes/djs/index.js";
import type { DJsAdminRow } from "../../../loaders/djs.js";
import {
	DJDeleteConflictError,
	loadDJDeleteImpact,
	removeDJ,
} from "../../../loaders/remove-dj.js";
import { MessageModal } from "../../shared/modal/index.js";
import styles from "./delete-dj-modal.module.css";

type Props = {
	dj: DJsAdminRow;
	onClose: () => void;
	onDeleted: (id: number) => void;
};

export const DeleteDJModal = ({ dj, onClose, onDeleted }: Props) => {
	const [impact, setImpact] = useState<DJDeleteImpact>();
	const [loadError, setLoadError] = useState<string>();
	const [deleteError, setDeleteError] = useState<string>();
	const loadVersion = useRef(0);
	const [pending, setPending] = useState(false);
	const submitting = useRef(false);
	const refreshImpact = useCallback(() => {
		const version = ++loadVersion.current;
		setImpact(undefined);
		setLoadError(undefined);
		loadDJDeleteImpact(dj.id)
			.then((result) => {
				if (version === loadVersion.current) setImpact(result);
			})
			.catch((error: unknown) => {
				if (version === loadVersion.current)
					setLoadError(
						error instanceof Error
							? error.message
							: "DJ impact could not be loaded. Please retry.",
					);
			});
	}, [dj.id]);
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
		if (submitting.current || impact === undefined || impact.shows.length > 0)
			return;
		submitting.current = true;
		setPending(true);
		setDeleteError(undefined);
		try {
			await removeDJ({ id: dj.id });
			onDeleted(dj.id);
		} catch (error) {
			if (error instanceof DJDeleteConflictError) refreshImpact();
			setDeleteError(
				error instanceof Error
					? error.message
					: "DJ could not be deleted. Please retry.",
			);
		} finally {
			submitting.current = false;
			setPending(false);
		}
	};
	return (
		<MessageModal
			title="Delete DJ?"
			message={`Permanently delete “${impact?.dj.title ?? dj.title}” from the archive?`}
			role="alertdialog"
			initialFocus="secondary"
			restoreFocus
			onDismiss={dismiss}
			secondaryAction={{ label: "Cancel", onClick: dismiss, disabled: pending }}
			primaryAction={{
				label: pending ? "Deleting…" : "Delete DJ",
				onClick: () => {
					void confirm();
				},
				disabled: pending || impact === undefined || impact.shows.length > 0,
				destructive: true,
			}}
		>
			<p className={styles.note}>
				DJ details, images, and direct tag links are permanently removed. This
				cannot be undone.
			</p>
			{impact === undefined && loadError === undefined && (
				<p role="status">Loading associated Shows…</p>
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
					<section aria-label="Associated Shows">
						<h3>Shows ({impact.shows.length})</h3>
						{impact.shows.length === 0 ? (
							<p>No associated Shows. This DJ can be deleted.</p>
						) : (
							<ul>
								{impact.shows.map((show) => (
									<li key={show.id}>{show.title}</li>
								))}
							</ul>
						)}
					</section>
					{impact.shows.length > 0 && (
						<p className={styles.note}>
							Remove this DJ from these Shows or delete the Shows separately.
							Then close and reopen this dialog.
						</p>
					)}
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
