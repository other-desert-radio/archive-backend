import { useCallback, useRef, useState } from "react";
import {
	hasFormChanges,
	type SelectedTag,
	uniqueSelectedTags,
} from "../../../shared/modal/index.js";
import { buildCreateShowRequest } from "../onboard-show-modal/onboard-show-utils.js";

export type ShowFormValues = {
	title: string;
	date: string;
	duration: string;
	image_small: string;
	image_large: string;
	tags: SelectedTag[];
	tagDraft: string;
	url: string;
	selected: number[];
};

/** Keeps editable values and the opening baseline together for every Show form. */
export const useShowFormState = (initialValues: ShowFormValues) => {
	const baseline = useRef(initialValues);
	const [fields, setFields] = useState(initialValues);
	const addOpeningRelationships = useCallback(
		(relationships: { tags?: SelectedTag[]; selected?: number[] }) => {
			const append = (values: ShowFormValues): ShowFormValues => ({
				...values,
				tags: uniqueSelectedTags([
					...values.tags,
					...(relationships.tags ?? []),
				]),
				selected: [
					...new Set([...values.selected, ...(relationships.selected ?? [])]),
				],
			});
			baseline.current = append(baseline.current);
			setFields(append);
		},
		[],
	);
	return {
		addOpeningRelationships,
		fields,
		setFields,
		hasUnsavedChanges: hasFormChanges(
			{ ...fields, tags: fields.tags.map(({ title }) => title) },
			{
				...baseline.current,
				tags: baseline.current.tags.map(({ title }) => title),
			},
		),
	};
};

/** Builds the ordinary Show payload, including an uncommitted tag draft. */
export const buildShowFormRequest = (fields: ShowFormValues) => {
	if (fields.selected.length === 0) throw new Error("Select at least one DJ.");
	if (fields.title.trim() === "") throw new Error("Title is required.");
	return buildCreateShowRequest({
		...fields,
		tags: [...fields.tags.map(({ title }) => title), fields.tagDraft].join(","),
		djs: fields.selected,
	});
};
