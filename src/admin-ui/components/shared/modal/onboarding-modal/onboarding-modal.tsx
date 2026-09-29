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
	isSubmitDisabled = false,
	children,
}: OnboardingModalProps) => {
	const panelRef = useRef<HTMLDivElement>(null);
	const [isConfirming, setIsConfirming] = useState(false);
	const dismissalOpenerRef = useRef<HTMLElement | undefined>(undefined);
	const [error, setError] = useState<string>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const dismiss = useCallback(() => {
		if (isSubmitting || isCovered || isConfirming) return;
		if (!hasUnsavedChanges) {
			onClose();
			return;
		}
		dismissalOpenerRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;
		setIsConfirming(true);
	}, [isSubmitting, isCovered, isConfirming, hasUnsavedChanges, onClose]);
	const keepEditing = () => {
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
		if (isCovered || isConfirming || isSubmitting || isSubmitDisabled) return;
		setError(undefined);
		setIsSubmitting(true);
		try {
			await onSubmit();
			onClose();
		} catch (submissionError) {
			setError(
				submissionError instanceof Error
					? submissionError.message
					: `${title} could not be created.`,
			);
		} finally {
			setIsSubmitting(false);
		}
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
					disabled={isSubmitting || isCovered || isConfirming}
					onClick={dismiss}
				/>
				<div
					ref={panelRef}
					tabIndex={-1}
					className={styles.panel}
					role="dialog"
					aria-modal="true"
					aria-hidden={isCovered || isConfirming || undefined}
					aria-labelledby="onboarding-modal-title"
					inert={isCovered || isConfirming || undefined}
				>
					<div className={styles.header}>
						<h2 id="onboarding-modal-title">{title}</h2>
						<button
							type="button"
							className={styles.close}
							aria-label="Close"
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
						<button
							type="submit"
							className={styles.submit}
							disabled={isSubmitting || isCovered || isSubmitDisabled}
						>
							{isSubmitting ? submittingLabel : submitLabel}
						</button>
						<button
							type="button"
							className={styles.cancel}
							onClick={dismiss}
							disabled={isSubmitting || isCovered}
						>
							{cancelLabel}
						</button>
					</form>
				</div>
			</div>
			{isConfirming && (
				<MessageModal
					title="Discard unsaved changes?"
					message="Your changes will be lost if you close this form."
					primaryAction={{ label: "Discard changes", onClick: onClose }}
					secondaryAction={{ label: "Keep editing", onClick: keepEditing }}
					onDismiss={keepEditing}
					initialFocus="secondary"
					role="alertdialog"
				/>
			)}
		</>
	);
};
