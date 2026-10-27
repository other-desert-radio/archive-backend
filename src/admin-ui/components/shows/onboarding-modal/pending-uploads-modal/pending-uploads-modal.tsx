import { useRef, useState } from "react";
import type { ShowsAdminRow } from "../../../../loaders/shows.js";
import {
	type PendingUpload,
	removePendingUpload,
} from "../../../../loaders/uploaded-show.js";
import { MessageModal } from "../../../shared/modal/index.js";
import type { ShowFormOptions } from "../show-form-modal/index.js";
import {
	SavedShowModal,
	UploadedShowModal,
} from "../uploaded-show-modal/index.js";
import styles from "./pending-uploads-modal.module.css";

type Props = ShowFormOptions & {
	items: PendingUpload[];
	isLoading: boolean;
	error: string | undefined;
	onRefresh: () => void;
	onSaved: (uploadId: number, show: ShowsAdminRow) => void;
	onRemoved: (uploadId: number) => void;
	tags: { id: number; title: string }[];
};

/** Resume durable confirmations through the existing fetch/review/save flow. */
export const PendingUploadsModal = (props: Props) => {
	const [selected, setSelected] = useState<PendingUpload>();
	const [saved, setSaved] = useState<ShowsAdminRow>();
	const [removingId, setRemovingId] = useState<number>();
	const [removeError, setRemoveError] = useState<string>();
	const remove = async (uploadId: number) => {
		setRemovingId(uploadId);
		setRemoveError(undefined);
		try {
			await removePendingUpload(uploadId);
			props.onRemoved(uploadId);
		} catch {
			setRemoveError("Pending upload could not be removed.");
		} finally {
			setRemovingId(undefined);
		}
	};
	const opener = useRef(
		document.activeElement instanceof HTMLElement
			? document.activeElement
			: undefined,
	);
	const close = () => {
		props.onClose();
		window.setTimeout(() => {
			if (opener.current?.isConnected) opener.current.focus();
			else
				document
					.querySelector<HTMLInputElement>('input[aria-label="Search Shows"]')
					?.focus();
		});
	};
	if (saved)
		return (
			<SavedShowModal
				show={saved}
				djs={props.djs}
				tags={props.tags}
				onClose={() => setSaved(undefined)}
			/>
		);
	if (selected)
		return (
			<UploadedShowModal
				{...props}
				key={selected.uploadId}
				upload={selected}
				onClose={() => setSelected(undefined)}
				onSaved={(show) => {
					props.onSaved(selected.uploadId, show);
					setSelected(undefined);
					setSaved(show);
				}}
			/>
		);
	return (
		<MessageModal
			title="Pending uploads"
			message="Uploads that have not been saved to the archive. Resume to load details and review."
			onDismiss={close}
			panelClassName={styles.panel}
			showCloseButton
			initialFocus="close"
			actionLayout="stacked"
			primaryAction={{
				label: "Refresh",
				onClick: props.onRefresh,
				disabled: props.isLoading || removingId !== undefined,
			}}
		>
			{props.isLoading && <p role="status">Loading pending uploads…</p>}
			{props.error && (
				<p role="alert" className={styles.error}>
					{props.error}
				</p>
			)}
			{removeError && (
				<p role="alert" className={styles.error}>
					{removeError}
				</p>
			)}
			{!props.isLoading && !props.error && props.items.length === 0 && (
				<p>No pending uploads.</p>
			)}
			<ul className={styles.list}>
				{props.items.map((upload) => (
					<li key={upload.uploadId}>
						<div className={styles.details}>
							<strong>{upload.title}</strong>
							<span>{upload.date}</span>
							<a href={upload.url} target="_blank" rel="noreferrer">
								{upload.key}
							</a>
						</div>
						<div className={styles.actions}>
							<button
								type="button"
								disabled={props.isLoading || removingId !== undefined}
								onClick={() => setSelected(upload)}
								aria-label={`Resume ${upload.title}`}
							>
								Resume
							</button>
							<button
								type="button"
								disabled={props.isLoading || removingId !== undefined}
								onClick={() => {
									void remove(upload.uploadId);
								}}
								aria-label={`Remove ${upload.title}`}
								title="Remove this pending record only; the Mixcloud upload is unchanged."
							>
								{removingId === upload.uploadId ? "Removing…" : "Remove"}
							</button>
						</div>
					</li>
				))}
			</ul>
		</MessageModal>
	);
};
