import { useCallback, useEffect, useRef, useState } from "react";
import type { SpecialDeleteImpact } from "../../../../admin/routes/specials/index.js";
import {
	loadSpecialDeleteImpact,
	removeSpecial,
	SpecialDeleteConflictError,
} from "../../../loaders/remove-special.js";
import type { SpecialsAdminRow } from "../../../loaders/specials.js";
import { MessageModal } from "../../shared/modal/index.js";
import styles from "./delete-special-modal.module.css";

type Props = {
	special: SpecialsAdminRow;
	onClose: () => void;
	onDeleted: (id: number) => void;
};

export const DeleteSpecialModal = ({ special, onClose, onDeleted }: Props) => {
	const [impact, setImpact] = useState<SpecialDeleteImpact>();
	const [loadError, setLoadError] = useState<string>();
	const [deleteError, setDeleteError] = useState<string>();
	const loadVersion = useRef(0);
	const [pending, setPending] = useState(false);
	const submitting = useRef(false);
	const refreshImpact = useCallback(() => {
		const version = ++loadVersion.current;
		setImpact(undefined);
		setLoadError(undefined);
		loadSpecialDeleteImpact(special.id)
			.then((result) => {
				if (version === loadVersion.current) setImpact(result);
			})
			.catch((error: unknown) => {
				if (version === loadVersion.current)
					setLoadError(
						error instanceof Error
							? error.message
							: "Special impact could not be loaded. Please retry.",
					);
			});
	}, [special.id]);
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
			await removeSpecial({ id: special.id });
			onDeleted(special.id);
		} catch (error) {
			if (error instanceof SpecialDeleteConflictError) refreshImpact();
			setDeleteError(
				error instanceof Error
					? error.message
					: "Special could not be deleted. Please retry.",
			);
		} finally {
			submitting.current = false;
			setPending(false);
		}
	};
	return (
		<MessageModal
			title="Delete Special?"
			message={`Permanently delete “${impact?.special.title ?? special.title}” from the archive?`}
			role="alertdialog"
			initialFocus="secondary"
			restoreFocus
			onDismiss={dismiss}
			secondaryAction={{ label: "Cancel", onClick: dismiss, disabled: pending }}
			primaryAction={{
				label: pending ? "Deleting…" : "Delete Special",
				onClick: () => {
					void confirm();
				},
				disabled: pending || impact === undefined || impact.shows.length > 0,
				destructive: true,
			}}
		>
			<p className={styles.note}>
				This special is permanently removed. This cannot be undone.
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
							<p>No associated Shows. This Special can be deleted.</p>
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
							Remove this Special from these Shows or delete the Shows
							separately. Then close and reopen this dialog.
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
