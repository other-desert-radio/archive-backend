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

type HeaderContentRenderer = (state: { isSubmitting: boolean }) => ReactNode;

const renderHeaderContent = (
	renderer: HeaderContentRenderer,
	state: { isSubmitting: boolean },
): ReactNode => {
	return renderer(state);
};

type OnboardingModalProps = {
	isOpen: boolean;
	/** Keep the panel bounds stable as multi-value fields wrap. */
	fillAvailableHeight?: boolean;
	isCovered?: boolean;
	hasUnsavedChanges?: boolean;
	allowUnchangedSubmit?: boolean;
	title: string;
	titleSuffix?: ReactNode;
	headerAction?: ModalAction | undefined;
	onClose: () => void;
	onSubmit: () => Promise<void>;
	submitLabel?: string;
	submittingLabel?: string;
	cancelLabel: string;
	actionHelper?: string;
	headerContent?: ReactNode | HeaderContentRenderer;
	navigationAction?: ModalAction;
	previousNavigationAction?: ModalAction;
	secondaryAction?: ModalAction;
	/** Replaces automatic closure after a successful submit; owns any follow-up errors. */
	onSubmitted?: () => void;
	isSubmitDisabled?: boolean;
	children: ReactNode;
};
/** Provides the common accessible shell and submission lifecycle for onboarding forms. */
export const OnboardingModal = ({
	isOpen,
	fillAvailableHeight = false,
	isCovered = false,
	hasUnsavedChanges = false,
	allowUnchangedSubmit = false,
	title,
	titleSuffix,
	headerAction,
	onClose,
	onSubmit,
	submitLabel = "Submit",
	submittingLabel = "Submitting…",
	cancelLabel,
	actionHelper,
	headerContent,
	navigationAction,
	previousNavigationAction,
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
	const isUnchangedSubmitDisabled = !hasUnsavedChanges && !allowUnchangedSubmit;
	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (
			isCovered ||
			isConfirming ||
			submittingRef.current ||
			isSubmitDisabled ||
			isUnchangedSubmitDisabled
		)
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
					<div
						className={`${styles.panel} ${fillAvailableHeight ? styles.stableHeight : ""}`}
					>
						<div className={styles.header}>
							<h2 id="onboarding-modal-title">
								{title}
								{titleSuffix}
							</h2>
							<div className={styles.headerActions}>
								{typeof headerContent === "function"
									? renderHeaderContent(headerContent, { isSubmitting })
									: headerContent}
								{headerAction !== undefined && (
									<button
										type="button"
										className={`${styles.cancel} ${styles.headerAction}`}
										disabled={
											headerAction.disabled || isSubmitting || isCovered
										}
										onClick={() => requestAction(headerAction.onClick)}
									>
										{headerAction.label}
									</button>
								)}
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
								disabled={
									isSubmitting ||
									isCovered ||
									isSubmitDisabled ||
									isUnchangedSubmitDisabled
								}
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
					{previousNavigationAction !== undefined && (
						<button
							type="button"
							className={`${styles.navigation} ${styles.previousNavigation}`}
							aria-label={previousNavigationAction.label}
							data-modal-dismiss
							disabled={
								isSubmitting || isCovered || previousNavigationAction.disabled
							}
							onClick={() => requestAction(previousNavigationAction.onClick)}
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
