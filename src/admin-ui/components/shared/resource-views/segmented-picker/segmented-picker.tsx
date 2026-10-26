import type { ReactElement } from "react";
import styles from "./segmented-picker.module.css";

export type SegmentedPickerOption<Value extends string> = {
	value: Value;
	label: string;
	tooltip?: string;
};

export type SegmentedPickerProps<Value extends string> = {
	label: string;
	value: Value;
	options: readonly SegmentedPickerOption<Value>[];
	onChange: (value: Value) => void;
	disabled?: boolean;
	appearance?: "default" | "muted";
};

/** Controlled selection; callers own state, persistence, and side effects. */
export const SegmentedPicker = <Value extends string>({
	label,
	value,
	options,
	onChange,
	disabled = false,
	appearance = "default",
}: SegmentedPickerProps<Value>): ReactElement => {
	return (
		<fieldset
			className={`${styles.picker} ${appearance === "muted" ? styles.muted : ""}`}
			aria-label={label}
			disabled={disabled}
		>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					className={option.value === value ? styles.selected : undefined}
					aria-pressed={option.value === value}
					title={option.tooltip}
					onClick={() => onChange(option.value)}
				>
					{option.label}
				</button>
			))}
		</fieldset>
	);
};
