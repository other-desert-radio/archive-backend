import { type RefObject, useEffect, useRef } from "react";

const getFocusableElements = (panel: HTMLElement) =>
	Array.from(
		panel.querySelectorAll<HTMLElement>(
			'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hasAttribute("hidden"));

type Options = {
	panelRef: RefObject<HTMLElement | null>;
	isOpen: boolean;
	isCovered?: boolean;
	onEscape?: (() => void) | undefined;
	initialFocusSelector?: string;
	restoreFocus?: boolean;
};

/** Focuses an opened dialog, contains Tab navigation and optionally restores its opener. */
export const useDialogFocus = ({
	panelRef,
	isOpen,
	isCovered = false,
	onEscape,
	initialFocusSelector,
	restoreFocus = true,
}: Options) => {
	const openerRef = useRef<HTMLElement | undefined>(undefined);
	useEffect(() => {
		if (!isOpen) return;
		openerRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;
		const timer = window.setTimeout(() => {
			const panel = panelRef.current;
			const preferred = initialFocusSelector
				? panel?.querySelector<HTMLElement>(initialFocusSelector)
				: undefined;
			(
				preferred ??
				(initialFocusSelector && panel
					? getFocusableElements(panel)[0]
					: undefined) ??
				panel
			)?.focus();
		});
		return () => {
			window.clearTimeout(timer);
			if (restoreFocus && openerRef.current?.isConnected)
				openerRef.current.focus();
		};
	}, [isOpen, panelRef, initialFocusSelector, restoreFocus]);
	useEffect(() => {
		if (!isOpen || isCovered) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if (event.key === "Escape" && onEscape) {
				event.preventDefault();
				onEscape();
				return;
			}
			if (event.key !== "Tab" || !panelRef.current) return;
			const panel = panelRef.current;
			const focusable = getFocusableElements(panel);
			const first = focusable[0];
			const last = focusable.at(-1);
			if (!first) {
				event.preventDefault();
				panel.focus();
				return;
			}
			if (
				event.shiftKey &&
				(document.activeElement === first || document.activeElement === panel)
			) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, isCovered, onEscape, panelRef]);
};
