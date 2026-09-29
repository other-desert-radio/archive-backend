import { useId, useRef } from "react";
import { useDialogFocus } from "../dialog-focus/index.js";
import styles from "./message-modal.module.css";

export type MessageModalAction = {
	label: string;
	onClick: () => void;
	disabled?: boolean;
};

type MessageModalProps = {
	title: string;
	message: string;
	primaryAction: MessageModalAction;
	secondaryAction?: MessageModalAction;
	additionalActions?: MessageModalAction[];
	onDismiss: () => void;
	initialFocus?: "primary" | "secondary";
	role?: "dialog" | "alertdialog";
};

/** Presents a message and caller-supplied actions with keyboard focus containment. */
export const MessageModal = ({
	title,
	message,
	primaryAction,
	secondaryAction,
	additionalActions = [],
	onDismiss,
	initialFocus = "primary",
	role = "dialog",
}: MessageModalProps) => {
	const panelRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const descriptionId = useId();
	useDialogFocus({
		panelRef,
		isOpen: true,
		onEscape: onDismiss,
		initialFocusSelector: `button[data-action="${initialFocus}"]:not([disabled])`,
		restoreFocus: false,
	});
	const actions = [
		...(secondaryAction ? [{ ...secondaryAction, kind: "secondary" }] : []),
		{ ...primaryAction, kind: "primary" },
		...additionalActions.map((action) => ({ ...action, kind: "additional" })),
	];
	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				tabIndex={-1}
				aria-label="Dismiss message"
				onClick={onDismiss}
			/>
			<dialog
				open
				ref={panelRef}
				tabIndex={-1}
				className={styles.panel}
				role={role}
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
			>
				<h2 id={titleId}>{title}</h2>
				<p id={descriptionId}>{message}</p>
				<div className={styles.actions}>
					{actions.map((action) => (
						<button
							key={action.label}
							type="button"
							data-action={action.kind}
							disabled={action.disabled}
							onClick={action.onClick}
						>
							{action.label}
						</button>
					))}
				</div>
			</dialog>
		</div>
	);
};
