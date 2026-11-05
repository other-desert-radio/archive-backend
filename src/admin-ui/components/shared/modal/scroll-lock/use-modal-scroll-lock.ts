import { useEffect } from "react";

let openModals = 0;
let restoreScroll: (() => void) | undefined;

/** Keep the document locked until the last modal closes, including covered forms. */
export const useModalScrollLock = (isOpen: boolean) => {
	useEffect(() => {
		if (!isOpen) return;
		if (openModals === 0) {
			const root = document.documentElement;
			const body = document.body;
			const rootOverflow = root.style.overflow;
			const bodyOverflow = body.style.overflow;
			const gutter = root.style.scrollbarGutter;
			if (window.innerWidth > root.clientWidth)
				root.style.scrollbarGutter = "stable";
			root.style.overflow = "hidden";
			body.style.overflow = "hidden";
			restoreScroll = () => {
				root.style.overflow = rootOverflow;
				body.style.overflow = bodyOverflow;
				root.style.scrollbarGutter = gutter;
			};
		}
		openModals += 1;
		return () => {
			openModals -= 1;
			if (openModals === 0) {
				restoreScroll?.();
				restoreScroll = undefined;
			}
		};
	}, [isOpen]);
};
