import { type ReactNode, useId, useRef } from "react";
import { useDialogFocus } from "../dialog-focus/index.js";
import styles from "./message-modal.module.css";

export type MessageModalAction = {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	destructive?: boolean;
	appearance?: "text";
};

type MessageModalProps = {
	title: string;
	message: string;
	primaryAction: MessageModalAction;
	secondaryAction?: MessageModalAction;
	additionalActions?: MessageModalAction[];
	onDismiss: () => void;
	initialFocus?: "primary" | "secondary" | "close";
	role?: "dialog" | "alertdialog";
	children?: ReactNode;
	restoreFocus?: boolean;
	panelClassName?: string | undefined;
	actionLayout?: "row" | "stacked";
	showCloseButton?: boolean;
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
	children,
	restoreFocus = false,
	panelClassName,
	actionLayout = "row",
	showCloseButton = false,
}: MessageModalProps) => {
	const panelRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const descriptionId = useId();
	useDialogFocus({
		panelRef,
		isOpen: true,
		onEscape: onDismiss,
		initialFocusSelector: `button[data-action="${initialFocus}"]:not([disabled])`,
		restoreFocus,
	});
	const primary = { ...primaryAction, kind: "primary" };
	const secondary = secondaryAction
		? [{ ...secondaryAction, kind: "secondary" }]
		: [];
	const actions = [
		...(actionLayout === "stacked"
			? [primary, ...secondary]
			: [...secondary, primary]),
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
				className={[styles.panel, panelClassName].filter(Boolean).join(" ")}
				role={role}
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={message ? descriptionId : undefined}
			>
				{showCloseButton ? (
					<div className={styles.header}>
						<h2 id={titleId}>{title}</h2>
						<button
							type="button"
							className={styles.close}
							aria-label="Close dialog"
							data-action="close"
							onClick={onDismiss}
						>
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path d="m6 6 12 12M18 6 6 18" />
							</svg>
						</button>
					</div>
				) : (
					<h2 id={titleId}>{title}</h2>
				)}
				{message && <p id={descriptionId}>{message}</p>}
				{children}
				<div
					className={[
						styles.actions,
						actionLayout === "stacked" ? styles.stacked : undefined,
					]
						.filter(Boolean)
						.join(" ")}
				>
					{actions.map((action) => (
						<button
							key={action.label}
							type="button"
							data-action={action.kind}
							className={[
								action.destructive ? styles.destructive : undefined,
								action.appearance === "text" ? styles.textAction : undefined,
							]
								.filter(Boolean)
								.join(" ")}
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
