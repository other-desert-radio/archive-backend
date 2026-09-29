import { useEffect, useId, useRef } from "react";
import styles from "./discard-confirmation.module.css";

type Props = { onKeepEditing: () => void; onDiscard: () => void };

export const DiscardConfirmation = ({ onKeepEditing, onDiscard }: Props) => {
	const keepRef = useRef<HTMLButtonElement>(null);
	const discardRef = useRef<HTMLButtonElement>(null);
	const titleId = useId();
	const descriptionId = useId();
	useEffect(() => {
		keepRef.current?.focus();
	}, []);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Backdrop dismissal supplements the accessible Cancel button and Escape handler.
		// biome-ignore lint/a11y/useKeyWithClickEvents: Keyboard dismissal is handled by the dialog Escape handler.
		<div
			className={styles.overlay}
			onClick={(event) => {
				if (event.target === event.currentTarget) onKeepEditing();
			}}
		>
			<div
				className={styles.panel}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						onKeepEditing();
					} else if (event.key === "Tab") {
						event.preventDefault();
						(document.activeElement === keepRef.current
							? discardRef
							: keepRef
						).current?.focus();
					}
				}}
			>
				<h2 id={titleId}>Discard unsaved changes?</h2>
				<p id={descriptionId}>
					Your changes will be lost if you close this form.
				</p>
				<div className={styles.actions}>
					<button ref={keepRef} type="button" onClick={onKeepEditing}>
						Keep editing
					</button>
					<button ref={discardRef} type="button" onClick={onDiscard}>
						Discard changes
					</button>
				</div>
			</div>
		</div>
	);
};
