import type { Dispatch, SetStateAction } from "react";
import { LabeledFormControl } from "../../../shared/modal/index.js";
import type { ShowFormValues } from "../show-form-state/index.js";
import { parseShowDuration } from "./show-duration-utils.js";

type Props = {
	fields: ShowFormValues;
	setFields: Dispatch<SetStateAction<ShowFormValues>>;
	idPrefix: string;
};
export const ShowDurationField = ({ fields, setFields, idPrefix }: Props) => {
	const { duration } = fields;

	let helper: string | undefined;
	let error: string | undefined;
	if (duration.trim() !== "") {
		try {
			const seconds = parseShowDuration(duration);
			helper = [
				[Math.floor(seconds / 3600), "hour"],
				[Math.floor((seconds % 3600) / 60), "minute"],
				[seconds % 60, "second"],
			]
				.filter(([value]) => value !== 0)
				.map(([value, unit]) => `${value} ${unit}${value === 1 ? "" : "s"}`)
				.join(", ");
		} catch (cause) {
			error = cause instanceof Error ? cause.message : "Invalid duration.";
		}
	}

	return (
		<LabeledFormControl
			id={`${idPrefix}-duration`}
			name="duration"
			label="duration"
			placeholder="m:ss or h:mm:ss"
			value={duration}
			onChange={(duration) => setFields({ ...fields, duration })}
			{...(helper === undefined ? {} : { helper })}
			{...(error === undefined ? {} : { error })}
			required
		/>
	);
};
