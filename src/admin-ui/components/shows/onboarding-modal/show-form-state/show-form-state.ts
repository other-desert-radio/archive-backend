import { useCallback, useRef, useState } from "react";
import {
	hasFormChanges,
	type SelectedTag,
	uniqueSelectedTags,
} from "../../../shared/modal/index.js";
import { buildCreateShowRequest } from "../onboard-show-modal/onboard-show-utils.js";

/** Editable Show values shared by creation, editing, and Mixcloud import forms. */
export type ShowFormValues = {
	title: string;
	/** UTC calendar date in YYYY-MM-DD input format, or empty before selection. */
	date: string;
	/** Seconds kept as input text until request validation. */
	duration: string;
	image_small: string;
	image_large: string;
	tags: SelectedTag[];
	/** Uncommitted tag input; included in dirty checks and submission. */
	tagDraft: string;
	url: string;
	/** Selected archive DJ IDs in selection order. */
	selected: number[];
};

/**
 * Keeps editable values and the opening baseline together for every Show form.
 * Initial values are captured on mount; remount to start a different Show draft.
 * Reverting edits clears dirty state, including relationship and tag-draft edits.
 */
export const useShowFormState = (initialValues: ShowFormValues) => {
	const baseline = useRef(initialValues);
	const [fields, setFields] = useState(initialValues);
	/**
	 * Adds asynchronously resolved opening relationships to both the draft and its
	 * baseline, preserving other edits. Repeated additions deduplicate selections.
	 */
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
		// Compare tag titles: source metadata is retained for import, not dirty state.
		hasUnsavedChanges: hasFormChanges(
			{ ...fields, tags: fields.tags.map(({ title }) => title) },
			{
				...baseline.current,
				tags: baseline.current.tags.map(({ title }) => title),
			},
		),
	};
};

/**
 * Builds the ordinary Show payload, including an uncommitted tag draft.
 * Requires a DJ and nonblank title, then delegates remaining normalization and
 * validation to the creation request builder. Tag metadata stays out of this
 * payload; Mixcloud import handles source-tag onboarding separately.
 * @throws When required fields or the delegated payload validation fail.
 */
export const buildShowFormRequest = (fields: ShowFormValues) => {
	if (fields.selected.length === 0) throw new Error("Select at least one DJ.");
	if (fields.title.trim() === "") throw new Error("Title is required.");
	return buildCreateShowRequest({
		...fields,
		tags: [...fields.tags.map(({ title }) => title), fields.tagDraft].join(","),
		djs: fields.selected,
	});
};
