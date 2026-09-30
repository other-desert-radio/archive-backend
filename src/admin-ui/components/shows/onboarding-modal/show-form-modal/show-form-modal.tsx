import { useEffect, useRef, useState } from "react";
import {
	hasFormChanges,
	LabeledFormControl,
	OnboardingModal,
	SearchableMultiSelect,
	TagsInput,
	useTagOptions,
} from "../../../shared/modal/index.js";
import {
	buildCreateShowRequest,
	type CreateShowForm,
} from "../onboard-show-modal/onboard-show-utils.js";

export type ShowFormValues = {
	title: string;
	date: string;
	duration: string;
	image: string;
	tags: string[];
	tagDraft: string;
	url: string;
	selected: number[];
};
export type ShowFormOptions = {
	djs: { id: number; title: string }[];
	isDJsLoading: boolean;
	djsError?: string;
	onRetryDJs: () => void;
	onClose: () => void;
};
type Props = ShowFormOptions & {
	initialValues: ShowFormValues;
	unresolvedTagIds?: number[];
	title: string;
	idPrefix: string;
	submitLabel?: string;
	submittingLabel?: string;
	onSubmit: (request: CreateShowForm) => Promise<void>;
};

/** Shared Show create/edit values, controls, validation, and modal lifecycle. */
export const ShowFormModal = ({
	initialValues,
	unresolvedTagIds = [],
	title: modalTitle,
	idPrefix,
	submitLabel,
	submittingLabel,
	djs,
	isDJsLoading,
	djsError,
	onRetryDJs,
	onClose,
	onSubmit,
}: Props) => {
	const baseline = useRef(initialValues);
	const [fields, setFields] = useState(initialValues);
	const [pendingTagIds, setPendingTagIds] = useState(unresolvedTagIds);
	const { tagOptions, isTagsLoading, tagsError, loadTagOptions } =
		useTagOptions(true);
	useEffect(() => {
		onRetryDJs();
	}, [onRetryDJs]);
	// Resolve missing opening tags without resetting metadata or any typed draft.
	useEffect(() => {
		if (pendingTagIds.length === 0 || isTagsLoading || tagsError !== undefined)
			return;
		const resolved = tagOptions.filter((tag) => pendingTagIds.includes(tag.id));
		if (resolved.length === 0) return;
		const titles = resolved.map((tag) => tag.title);
		baseline.current = {
			...baseline.current,
			tags: [...baseline.current.tags, ...titles],
		};
		setFields((current) => ({
			...current,
			tags: [...current.tags, ...titles],
		}));
		setPendingTagIds((current) =>
			current.filter((id) => !resolved.some((tag) => tag.id === id)),
		);
	}, [pendingTagIds, tagOptions, isTagsLoading, tagsError]);
	const tagError =
		tagsError ??
		(pendingTagIds.length > 0 && !isTagsLoading
			? "Some assigned tags could not be loaded. Retry before saving."
			: undefined);
	const { title, date, duration, image, tags, tagDraft, url, selected } =
		fields;
	const djOptions = djs.map((dj) => ({
		id: dj.id,
		label: `${dj.title} (#${dj.id})`,
		searchText: `${dj.title} ${dj.id}`,
	}));
	const submit = async () => {
		if (pendingTagIds.length > 0)
			throw new Error("Assigned tags must finish loading before saving.");
		if (isDJsLoading || djsError !== undefined)
			throw new Error("DJs must finish loading before submitting.");
		if (selected.length === 0) throw new Error("Select at least one DJ.");
		if (title.trim() === "") throw new Error("Title is required.");
		await onSubmit(
			buildCreateShowRequest({
				title,
				date,
				duration,
				image,
				tags: [...tags, tagDraft].join(","),
				url,
				djs: selected,
			}),
		);
	};
	return (
		<OnboardingModal
			isOpen
			hasUnsavedChanges={hasFormChanges(fields, baseline.current)}
			title={modalTitle}
			onClose={onClose}
			onSubmit={submit}
			cancelLabel="Cancel"
			isSubmitDisabled={pendingTagIds.length > 0}
			{...(submitLabel === undefined ? {} : { submitLabel })}
			{...(submittingLabel === undefined ? {} : { submittingLabel })}
		>
			<LabeledFormControl
				id={`${idPrefix}-title`}
				name="title"
				label="title"
				value={title}
				onChange={(title) => setFields({ ...fields, title })}
				required
			/>
			<LabeledFormControl
				id={`${idPrefix}-date`}
				name="date"
				label="date"
				type="date"
				value={date}
				onChange={(date) => setFields({ ...fields, date })}
				required
			/>
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
			<LabeledFormControl
				id={`${idPrefix}-image`}
				name="image"
				label="image URL"
				type="url"
				value={image}
				onChange={(image) => setFields({ ...fields, image })}
			/>
			<SearchableMultiSelect
				id={`${idPrefix}-djs`}
				label="DJs"
				options={djOptions}
				selectedIds={selected}
				onChange={(selected) => setFields({ ...fields, selected })}
				isLoading={isDJsLoading}
				{...(djsError === undefined ? {} : { error: djsError })}
				onRetry={onRetryDJs}
			/>
			<TagsInput
				id={`${idPrefix}-tags`}
				value={{ tags, draft: tagDraft }}
				onChange={(value) =>
					setFields({ ...fields, tags: value.tags, tagDraft: value.draft })
				}
				options={tagOptions}
				isLoading={isTagsLoading}
				{...(tagError === undefined ? {} : { error: tagError })}
				onRetry={loadTagOptions}
			/>
			<LabeledFormControl
				id={`${idPrefix}-url`}
				name="url"
				label="show URL"
				type="url"
				value={url}
				onChange={(url) => setFields({ ...fields, url })}
				required
			/>
		</OnboardingModal>
	);
};
