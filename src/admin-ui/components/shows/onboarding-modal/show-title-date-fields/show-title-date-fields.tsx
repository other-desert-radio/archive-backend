import type { Dispatch, ReactNode, SetStateAction } from "react";
import { LabeledFormControl } from "../../../shared/modal/index.js";
import type { ShowFormValues } from "../show-form-state/index.js";

type Props = {
	fields: ShowFormValues;
	setFields: Dispatch<SetStateAction<ShowFormValues>>;
	idPrefix: string;
	dateError?: string | undefined;
	children?: ReactNode;
};
export const ShowTitleDateFields = ({
	fields,
	setFields,
	idPrefix,
	dateError,
	children,
}: Props) => {
	const { title, date } = fields;
	return (
		<>
			<LabeledFormControl
				id={`${idPrefix}-title`}
				name="title"
				label="title"
				value={title}
				onChange={(title) => setFields({ ...fields, title })}
				required
			/>
			{children}
			<LabeledFormControl
				id={`${idPrefix}-date`}
				name="date"
				label="date"
				type="date"
				{...(dateError === undefined ? {} : { error: dateError })}
				value={date}
				onChange={(date) => setFields({ ...fields, date })}
				required
			/>
		</>
	);
};
