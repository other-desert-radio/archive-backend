import { useRef, useState } from "react";
import { splitCommaSeparated } from "../../../utils/index.js";
import { validateTags } from "../../loaders/validate-tags.js";
import { LabeledFormControl } from "./labeled-form-control.js";

type CommaSeparatedTagsFieldProps = {
	id: string;
	value: string;
	onChange: (value: string) => void;
};

/** Validates comma-separated tag names on blur without creating tags. */
export const CommaSeparatedTagsField = ({
	id,
	value,
	onChange,
}: CommaSeparatedTagsFieldProps) => {
	const [missingTags, setMissingTags] = useState<string[]>([]);
	const requestVersion = useRef(0);
	const handleChange = (nextValue: string) => {
		requestVersion.current += 1;
		setMissingTags([]);
		onChange(nextValue);
	};
	const handleBlur = async () => {
		const tags = splitCommaSeparated(value);
		if (tags.length === 0) return;
		const version = ++requestVersion.current;
		try {
			const result = await validateTags(tags);
			if (version === requestVersion.current) setMissingTags(result.invalid);
		} catch {
			// Server-side creation still validates tags during final submission.
		}
	};
	return (
		<LabeledFormControl
			id={id}
			name="tags"
			label="tags"
			value={value}
			onChange={handleChange}
			onBlur={handleBlur}
			{...(missingTags.length === 0
				? {}
				: {
						helper: `These tags will be created after submit: ${missingTags.join(", ")}.`,
					})}
		/>
	);
};
