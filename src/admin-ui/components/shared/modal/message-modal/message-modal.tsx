import { useEffect, useId, useRef } from "react";
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
	useEffect(() => {
		const panel = panelRef.current;
		const preferred = panel?.querySelector<HTMLButtonElement>(
			`button[data-action="${initialFocus}"]:not([disabled])`,
		);
		(
			preferred ??
			panel?.querySelector<HTMLButtonElement>("button:not([disabled])") ??
			panel
		)?.focus();
	}, [initialFocus]);
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
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						onDismiss();
					} else if (event.key === "Tab") {
						const buttons = Array.from(
							panelRef.current?.querySelectorAll<HTMLButtonElement>(
								"button:not([disabled])",
							) ?? [],
						);
						const index = buttons.indexOf(
							document.activeElement as HTMLButtonElement,
						);
						event.preventDefault();
						if (buttons.length === 0) panelRef.current?.focus();
						else
							buttons[
								(index + (event.shiftKey ? -1 : 1) + buttons.length) %
									buttons.length
							]?.focus();
					}
				}}
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
