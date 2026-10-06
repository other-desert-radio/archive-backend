import { type ReactNode, useEffect, useRef, useState } from "react";
import styles from "./toast-modal.module.css";

type ToastModalProps = {
	message: ReactNode;
	onDismiss: () => void;
};

/** A non-blocking success notice; mount a new keyed instance for each event. */
export const ToastModal = ({ message, onDismiss }: ToastModalProps) => {
	const [isFading, setIsFading] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const remainingTime = useRef(4000);
	const dismissRef = useRef(onDismiss);
	dismissRef.current = onDismiss;
	useEffect(() => {
		if (isHovered) return;
		const startedAt = Date.now();
		const fade = window.setTimeout(
			() => setIsFading(true),
			remainingTime.current,
		);
		const dismiss = window.setTimeout(
			() => dismissRef.current(),
			remainingTime.current + 250,
		);
		return () => {
			remainingTime.current = Math.max(
				0,
				remainingTime.current - (Date.now() - startedAt),
			);
			window.clearTimeout(fade);
			window.clearTimeout(dismiss);
		};
	}, [isHovered]);
	return (
		<div
			className={`${styles.toast} ${isFading ? styles.fading : ""}`}
			onPointerEnter={() => {
				setIsHovered(true);
				setIsFading(false);
			}}
			onPointerLeave={() => setIsHovered(false)}
		>
			<div className={styles.message} role="status">
				{message}
			</div>
			<button
				type="button"
				aria-label="Dismiss notification"
				onClick={onDismiss}
			>
				×
			</button>
		</div>
	);
};
