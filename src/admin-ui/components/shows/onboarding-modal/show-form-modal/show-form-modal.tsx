import { useEffect, useState } from "react";
import {
	LabeledFormControl,
	OnboardingModal,
	useTagOptions,
} from "../../../shared/modal/index.js";
import type { CreateShowForm } from "../onboard-show-modal/onboard-show-utils.js";
import { ShowDurationField } from "../show-duration-field/index.js";
import {
	buildShowFormRequest,
	type ShowFormValues,
	useShowFormState,
} from "../show-form-state/index.js";
import { ShowRelationshipFields } from "../show-relationship-fields/index.js";
import { ShowTitleDateFields } from "../show-title-date-fields/index.js";

export type { ShowFormValues } from "../show-form-state/index.js";

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
	const { addOpeningRelationships, fields, setFields, hasUnsavedChanges } =
		useShowFormState(initialValues);
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
		addOpeningRelationships({ tags: titles });
		setPendingTagIds((current) =>
			current.filter((id) => !resolved.some((tag) => tag.id === id)),
		);
	}, [
		pendingTagIds,
		tagOptions,
		isTagsLoading,
		tagsError,
		addOpeningRelationships,
	]);
	const tagError =
		tagsError ??
		(pendingTagIds.length > 0 && !isTagsLoading
			? "Some assigned tags could not be loaded. Retry before saving."
			: undefined);
	const { image_small, image_large, url } = fields;
	const submit = async () => {
		if (pendingTagIds.length > 0)
			throw new Error("Assigned tags must finish loading before saving.");
		if (isDJsLoading || djsError !== undefined)
			throw new Error("DJs must finish loading before submitting.");
		await onSubmit(buildShowFormRequest(fields));
	};
	return (
		<OnboardingModal
			isOpen
			hasUnsavedChanges={hasUnsavedChanges}
			title={modalTitle}
			onClose={onClose}
			onSubmit={submit}
			cancelLabel="Cancel"
			isSubmitDisabled={pendingTagIds.length > 0}
			{...(submitLabel === undefined ? {} : { submitLabel })}
			{...(submittingLabel === undefined ? {} : { submittingLabel })}
		>
			<ShowTitleDateFields
				fields={fields}
				setFields={setFields}
				idPrefix={idPrefix}
			/>
			<ShowDurationField
				fields={fields}
				setFields={setFields}
				idPrefix={idPrefix}
			/>
			<LabeledFormControl
				id={`${idPrefix}-image-small`}
				name="image_small"
				label="small image URL"
				type="url"
				value={image_small}
				onChange={(image_small) => setFields({ ...fields, image_small })}
				required
			/>
			<LabeledFormControl
				id={`${idPrefix}-image-large`}
				name="image_large"
				label="large image URL"
				type="url"
				value={image_large}
				onChange={(image_large) => setFields({ ...fields, image_large })}
				required
			/>
			<ShowRelationshipFields
				fields={fields}
				setFields={setFields}
				idPrefix={idPrefix}
				djs={djs}
				isDJsLoading={isDJsLoading}
				djsError={djsError}
				onRetryDJs={onRetryDJs}
				tagOptions={tagOptions}
				isTagsLoading={isTagsLoading}
				tagError={tagError}
				loadTagOptions={loadTagOptions}
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
