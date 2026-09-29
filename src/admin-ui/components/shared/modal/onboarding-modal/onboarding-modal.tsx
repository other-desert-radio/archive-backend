import {
	type FormEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import styles from "./onboarding-modal.module.css";

type OnboardingModalProps = {
	isOpen: boolean;
	isCovered?: boolean;
	title: string;
	onClose: () => void;
	onSubmit: () => Promise<void>;
	submitLabel?: string;
	submittingLabel?: string;
	cancelLabel: string;
	isSubmitDisabled?: boolean;
	children: ReactNode;
};
const getFocusableElements = (panel: HTMLElement) =>
	Array.from(
		panel.querySelectorAll<HTMLElement>(
			'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hasAttribute("hidden"));

/** Provides the common accessible shell and submission lifecycle for onboarding forms. */
export const OnboardingModal = ({
	isOpen,
	isCovered = false,
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
	const openerRef = useRef<HTMLElement | undefined>(undefined);
	const [error, setError] = useState<string>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	useEffect(() => {
		if (!isOpen) return;
		if (document.activeElement instanceof HTMLElement)
			openerRef.current = document.activeElement;
		else openerRef.current = undefined;
		setError(undefined);
		setIsSubmitting(false);
		const focusTimer = window.setTimeout(() =>
			getFocusableElements(panelRef.current ?? document.body)[0]?.focus(),
		);
		return () => window.clearTimeout(focusTimer);
	}, [isOpen]);
	useEffect(() => {
		if (!isOpen || isCovered) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if (event.key === "Escape" && !isSubmitting) {
				event.preventDefault();
				onClose();
				return;
			}
			if (event.key !== "Tab") return;
			const focusable = getFocusableElements(panelRef.current ?? document.body);
			if (focusable.length === 0) return;
			const first = focusable[0];
			if (first === undefined) return;
			const last = focusable.at(-1);
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isCovered, isOpen, isSubmitting, onClose]);
	useEffect(() => {
		if (isOpen) return;
		openerRef.current?.focus();
	}, [isOpen]);
	if (!isOpen) return null;
	const dismiss = () => {
		if (!isSubmitting && !isCovered) onClose();
	};
	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isCovered) return;
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
		<div className={styles.overlay}>
			<div
				ref={panelRef}
				className={styles.panel}
				role="dialog"
				aria-modal="true"
				aria-hidden={isCovered || undefined}
				aria-labelledby="onboarding-modal-title"
				inert={isCovered || undefined}
			>
				<div className={styles.header}>
					<h2 id="onboarding-modal-title">{title}</h2>
					<button
						type="button"
						aria-label="Close"
						onClick={dismiss}
						disabled={isSubmitting || isCovered}
					>
						x
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
	);
};
