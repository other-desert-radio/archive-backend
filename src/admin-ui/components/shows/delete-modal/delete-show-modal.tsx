import { useRef, useState } from "react";
import { removeShow } from "../../../loaders/remove-show.js";
import type { ShowsAdminRow } from "../../../loaders/shows.js";
import { MessageModal } from "../../shared/modal/index.js";
import styles from "./delete-show-modal.module.css";

type Props = {
	show: ShowsAdminRow;
	onClose: () => void;
	onDeleted: (id: number) => void;
};
export const DeleteShowModal = ({ show, onClose, onDeleted }: Props) => {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string>();
	const submitting = useRef(false);
	const dismiss = () => {
		if (!submitting.current) onClose();
	};
	const confirm = async () => {
		if (submitting.current) return;
		submitting.current = true;
		setPending(true);
		setError(undefined);
		try {
			await removeShow({ id: show.id });
			onDeleted(show.id);
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "Show could not be deleted. Please retry.",
			);
		} finally {
			submitting.current = false;
			setPending(false);
		}
	};
	return (
		<MessageModal
			title="Delete Show?"
			message={`Permanently delete “${show.title}” from the archive?`}
			role="alertdialog"
			initialFocus="secondary"
			restoreFocus
			onDismiss={dismiss}
			secondaryAction={{ label: "Cancel", onClick: dismiss, disabled: pending }}
			primaryAction={{
				label: pending ? "Deleting…" : "Delete Show",
				onClick: () => {
					void confirm();
				},
				disabled: pending,
				destructive: true,
			}}
		>
			<p className={styles.note}>
				Archive edits and DJ/tag links are permanently removed. Mixcloud stays
				unchanged; the show returns for import under the usual review rules.
			</p>
			{error && <p role="alert">{error}</p>}
		</MessageModal>
	);
};
