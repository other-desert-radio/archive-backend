import { type ReactNode, useEffect, useRef, useState } from "react";

type OnboardingModalProps = {
	isOpen: boolean;
	title: string;
	onClose: () => void;
	onSubmit: () => Promise<void>;
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
	title,
	onClose,
	onSubmit,
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
		if (!isOpen) return;
		const handleKeyDown = (event: KeyboardEvent) => {
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
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			openerRef.current?.focus();
		};
	}, [isOpen, isSubmitting, onClose]);
	if (!isOpen) return null;
	const dismiss = () => {
		if (!isSubmitting) onClose();
	};
	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
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
		<div className="onboarding-modal-overlay">
			<div
				ref={panelRef}
				className="onboarding-modal-panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="onboarding-modal-title"
			>
				<div className="onboarding-modal-header">
					<h2 id="onboarding-modal-title">{title}</h2>
					<button
						type="button"
						aria-label="Close"
						onClick={dismiss}
						disabled={isSubmitting}
					>
						x
					</button>
				</div>
				<form onSubmit={submit}>
					<fieldset disabled={isSubmitting} className="onboarding-modal-form">
						{children}
					</fieldset>
					{error !== undefined && (
						<p className="onboarding-modal-error" role="alert">
							{error}
						</p>
					)}
					<button
						type="submit"
						className="submit-button"
						disabled={isSubmitting}
					>
						{isSubmitting ? "Submitting…" : "Submit"}
					</button>
				</form>
			</div>
		</div>
	);
};
