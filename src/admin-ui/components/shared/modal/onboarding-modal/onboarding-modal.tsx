import {
	type FormEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useDialogFocus } from "../dialog-focus/index.js";
import { MessageModal } from "../message-modal/index.js";
import styles from "./onboarding-modal.module.css";

type ModalAction = {
	label: string;
	onClick: () => void;
	disabled?: boolean;
};

type OnboardingModalProps = {
	isOpen: boolean;
	isCovered?: boolean;
	hasUnsavedChanges?: boolean;
	title: string;
	onClose: () => void;
	onSubmit: () => Promise<void>;
	submitLabel?: string;
	submittingLabel?: string;
	cancelLabel: string;
	actionHelper?: string;
	headerContent?: ReactNode;
	navigationAction?: ModalAction;
	secondaryAction?: ModalAction;
	/** Replaces automatic closure after a successful submit; owns any follow-up errors. */
	onSubmitted?: () => void;
	isSubmitDisabled?: boolean;
	children: ReactNode;
};
/** Provides the common accessible shell and submission lifecycle for onboarding forms. */
export const OnboardingModal = ({
	isOpen,
	isCovered = false,
	hasUnsavedChanges = false,
	title,
	onClose,
	onSubmit,
	submitLabel = "Submit",
	submittingLabel = "Submitting…",
	cancelLabel,
	actionHelper,
	headerContent,
	navigationAction,
	secondaryAction,
	onSubmitted,
	isSubmitDisabled = false,
	children,
}: OnboardingModalProps) => {
	const panelRef = useRef<HTMLDivElement>(null);
	const [isConfirming, setIsConfirming] = useState(false);
	const dismissalOpenerRef = useRef<HTMLElement | undefined>(undefined);
	const [error, setError] = useState<string>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const pendingActionRef = useRef<(() => void) | undefined>(undefined);
	const submittingRef = useRef(false);
	const requestAction = useCallback(
		(action: () => void) => {
			if (submittingRef.current || isCovered || isConfirming) return;
			if (!hasUnsavedChanges) {
				action();
				return;
			}
			pendingActionRef.current = action;
			dismissalOpenerRef.current =
				document.activeElement instanceof HTMLElement
					? document.activeElement
					: undefined;
			setIsConfirming(true);
		},
		[isCovered, isConfirming, hasUnsavedChanges],
	);
	const dismiss = useCallback(
		() => requestAction(onClose),
		[requestAction, onClose],
	);
	const keepEditing = () => {
		pendingActionRef.current = undefined;
		setIsConfirming(false);
		window.setTimeout(() => {
			const opener = dismissalOpenerRef.current;
			if (opener?.isConnected && panelRef.current?.contains(opener))
				opener.focus();
			else panelRef.current?.focus();
		});
	};
	useEffect(() => {
		setIsConfirming(false);
		if (!isOpen) return;
		setError(undefined);
		setIsSubmitting(false);
	}, [isOpen]);
	useDialogFocus({
		panelRef,
		isOpen,
		isCovered: isCovered || isConfirming,
		onEscape: isSubmitting ? undefined : dismiss,
	});
	if (!isOpen) return null;
	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isCovered || isConfirming || submittingRef.current || isSubmitDisabled)
			return;
		setError(undefined);
		submittingRef.current = true;
		setIsSubmitting(true);
		try {
			await onSubmit();
		} catch (submissionError) {
			setError(
				submissionError instanceof Error
					? submissionError.message
					: `${title} could not be created.`,
			);
			return;
		} finally {
			submittingRef.current = false;
			setIsSubmitting(false);
		}
		// Mutation errors belong above; committed-success follow-up belongs to the caller.
		(onSubmitted ?? onClose)();
	};
	return (
		<>
			<div
				className={styles.overlay}
				inert={isCovered || isConfirming || undefined}
				aria-hidden={isCovered || isConfirming || undefined}
			>
				<button
					type="button"
					className={styles.backdrop}
					tabIndex={-1}
					aria-label="Cancel form"
					data-modal-dismiss
					disabled={isSubmitting || isCovered || isConfirming}
					onClick={dismiss}
				/>
				<div
					ref={panelRef}
					tabIndex={-1}
					className={`${styles.frame} ${navigationAction === undefined ? "" : styles.withNavigation}`}
					role="dialog"
					aria-modal="true"
					aria-hidden={isCovered || isConfirming || undefined}
					aria-labelledby="onboarding-modal-title"
					inert={isCovered || isConfirming || undefined}
				>
					<div className={styles.panel}>
						<div className={styles.header}>
							<h2 id="onboarding-modal-title">{title}</h2>
							<div className={styles.headerActions}>
								{headerContent}
								<button
									type="button"
									className={styles.close}
									aria-label="Close"
									data-modal-dismiss
									onClick={dismiss}
									disabled={isSubmitting || isCovered}
								>
									<svg
										width="24"
										height="24"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path d="M5 5 19 19M19 5 5 19" />
									</svg>
								</button>
							</div>
						</div>
						<form onSubmit={submit}>
							<fieldset
								disabled={isSubmitting || isCovered}
								className={styles.form}
							>
								{children}
							</fieldset>
							{error !== undefined && (
								<p className={styles.error} role="alert">
									{error}
								</p>
							)}
							{actionHelper !== undefined && (
								<p className={styles.actionHelper}>{actionHelper}</p>
							)}
							<button
								type="submit"
								className={styles.submit}
								disabled={isSubmitting || isCovered || isSubmitDisabled}
							>
								{isSubmitting ? submittingLabel : submitLabel}
							</button>
							<button
								type="button"
								className={`${styles.cancel} ${secondaryAction === undefined ? "" : styles.secondary}`}
								data-modal-dismiss
								onClick={() =>
									requestAction(secondaryAction?.onClick ?? onClose)
								}
								disabled={
									isSubmitting || isCovered || secondaryAction?.disabled
								}
							>
								{secondaryAction?.label ?? cancelLabel}
							</button>
						</form>
					</div>
					{navigationAction !== undefined && (
						<button
							type="button"
							className={styles.navigation}
							aria-label={navigationAction.label}
							data-modal-dismiss
							disabled={isSubmitting || isCovered || navigationAction.disabled}
							onClick={() => requestAction(navigationAction.onClick)}
						>
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path d="M4 12h16M13 5l7 7-7 7" />
							</svg>
						</button>
					)}
				</div>
			</div>
			{isConfirming && (
				<MessageModal
					title="Discard unsaved changes?"
					message={
						pendingActionRef.current === onClose
							? "Your changes will be lost if you close this form."
							: "Your changes will be lost if you continue."
					}
					primaryAction={{
						label: "Discard changes",
						onClick: () => {
							const action = pendingActionRef.current;
							pendingActionRef.current = undefined;
							setIsConfirming(false);
							action?.();
							window.setTimeout(() => panelRef.current?.focus());
						},
					}}
					secondaryAction={{ label: "Keep editing", onClick: keepEditing }}
					onDismiss={keepEditing}
					initialFocus="secondary"
					role="alertdialog"
				/>
			)}
		</>
	);
};
