import styles from "./count-button.module.css";

type Props = {
	label: string;
	count: number | undefined;
	title: string;
	ready?: boolean;
	disabled?: boolean;
	onClick: () => void;
};

/** Shared queue launcher with the Mixcloud import count badge. */
export const CountButton = ({
	label,
	count,
	title,
	ready = false,
	disabled,
	onClick,
}: Props) => (
	<button
		type="button"
		className={styles.category}
		title={title}
		aria-haspopup="dialog"
		disabled={disabled}
		onClick={onClick}
	>
		{label}
		{count !== undefined && count > 0 && (
			<span className={`${styles.count} ${ready ? styles.readyCount : ""}`}>
				{count}
			</span>
		)}
	</button>
);
