import { type ReactElement, useId } from "react";
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
};

/** Controlled selection; callers own state, persistence, and side effects. */
export const SegmentedPicker = <Value extends string>({
	label,
	value,
	options,
	onChange,
	disabled = false,
}: SegmentedPickerProps<Value>): ReactElement => {
	const id = useId();
	return (
		<fieldset className={styles.picker} aria-label={label} disabled={disabled}>
			{options.map((option) => (
				<span className={styles.segment} key={option.value}>
					<button
						type="button"
						className={option.value === value ? styles.selected : undefined}
						aria-pressed={option.value === value}
						aria-describedby={
							option.tooltip === undefined ? undefined : `${id}-${option.value}`
						}
						onClick={() => onChange(option.value)}
					>
						{option.label}
					</button>
					{option.tooltip !== undefined && (
						<span
							className={styles.tooltip}
							role="tooltip"
							id={`${id}-${option.value}`}
						>
							{option.tooltip}
						</span>
					)}
				</span>
			))}
		</fieldset>
	);
};
