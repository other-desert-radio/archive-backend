import styles from "./labeled-form-control.module.css";

type LabeledFormControlProps = {
	id: string;
	name: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	type?: "text" | "url" | "date" | "number";
	min?: number;
	max?: number;
	step?: number;
	required?: boolean;
	textarea?: boolean;
	helper?: string;
	error?: string;
};

/** Renders a labeled text input or textarea for resource-specific forms. */
export const LabeledFormControl = ({
	id,
	name,
	label,
	value,
	onChange,
	onBlur,
	type = "text",
	min,
	max,
	step,
	required = false,
	textarea = false,
	helper,
	error,
}: LabeledFormControlProps) => (
	<div className={`${styles.field} ${textarea ? styles.multiline : ""}`}>
		<label htmlFor={id}>{label}</label>
		<div>
			{textarea ? (
				<textarea
					id={id}
					name={name}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					onBlur={onBlur}
					required={required}
					aria-describedby={
						helper === undefined && error === undefined
							? undefined
							: `${id}-help`
					}
				/>
			) : (
				<input
					id={id}
					name={name}
					type={type}
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					onBlur={onBlur}
					required={required}
					aria-describedby={
						helper === undefined && error === undefined
							? undefined
							: `${id}-help`
					}
				/>
			)}
			{(helper !== undefined || error !== undefined) && (
				<p
					id={`${id}-help`}
					className={
						error === undefined
							? styles.helper
							: `${styles.helper} ${styles.fieldError}`
					}
				>
					{error ?? helper}
				</p>
			)}
		</div>
	</div>
);
