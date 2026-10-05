import type { Dispatch, SetStateAction } from "react";
import { LabeledFormControl } from "../../../shared/modal/index.js";
import type { ShowFormValues } from "../show-form-state/index.js";

type Props = {
	fields: ShowFormValues;
	setFields: Dispatch<SetStateAction<ShowFormValues>>;
	idPrefix: string;
};
export const ShowDurationField = ({ fields, setFields, idPrefix }: Props) => {
	const { duration } = fields;
	return (
		<LabeledFormControl
			id={`${idPrefix}-duration`}
			name="duration"
			label="duration (seconds)"
			type="number"
			min={1}
			max={2_147_483_647}
			step={1}
			value={duration}
			onChange={(duration) => setFields({ ...fields, duration })}
			required
		/>
	);
};
