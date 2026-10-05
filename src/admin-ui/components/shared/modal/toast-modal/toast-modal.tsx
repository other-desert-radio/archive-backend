import { type ReactNode, useEffect, useRef, useState } from "react";
import styles from "./toast-modal.module.css";

type ToastModalProps = {
	message: ReactNode;
	onDismiss: () => void;
};

/** A non-blocking success notice; mount a new keyed instance for each event. */
export const ToastModal = ({ message, onDismiss }: ToastModalProps) => {
	const [isFading, setIsFading] = useState(false);
	const dismissRef = useRef(onDismiss);
	dismissRef.current = onDismiss;
	useEffect(() => {
		const fade = window.setTimeout(() => setIsFading(true), 4000);
		const dismiss = window.setTimeout(() => dismissRef.current(), 4250);
		return () => {
			window.clearTimeout(fade);
			window.clearTimeout(dismiss);
		};
	}, []);
	return (
		<div className={`${styles.toast} ${isFading ? styles.fading : ""}`}>
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
