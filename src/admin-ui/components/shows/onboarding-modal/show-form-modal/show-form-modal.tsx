import { type ReactNode, useEffect, useState } from "react";
import {
	LabeledFormControl,
	OnboardingModal,
	useTagOptions,
} from "../../../shared/modal/index.js";
import { SegmentedPicker } from "../../../shared/resource-views/index.js";
import type { CreateShowForm } from "../onboard-show-modal/onboard-show-utils.js";
import { ShowDurationField } from "../show-duration-field/index.js";
import {
	buildShowFormRequest,
	type ShowFormValues,
	useShowFormState,
} from "../show-form-state/index.js";
import { ShowRelationshipFields } from "../show-relationship-fields/index.js";
import { ShowTitleDateFields } from "../show-title-date-fields/index.js";
import styles from "./show-form-modal.module.css";

export type { ShowFormValues } from "../show-form-state/index.js";

export type ShowOnboardingMode = "new_show" | "existing_show";

const modeDescriptions: Record<ShowOnboardingMode, string> = {
	new_show:
		"This show doesn't exist on Mixcloud yet. Submitting this form will upload there.",
	existing_show:
		"This show already exists on Mixcloud. This form will onboard it to our platform.",
};

export type ShowOnboardingModeControl = {
	value: ShowOnboardingMode;
	onChange: (mode: ShowOnboardingMode) => void;
};

export type ShowFormOptions = {
	djs: { id: number; title: string }[];
	isDJsLoading: boolean;
	djsError?: string;
	onRetryDJs: () => void;
	onClose: () => void;
};
type Props = ShowFormOptions & {
	/** Onboarding only; edit callers omit this control. */
	onboardingMode?: ShowOnboardingModeControl;
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
	onboardingMode,
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
		const titles = resolved.map((tag) => ({ title: tag.title }));
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
	const commonFields = (
		<>
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
		</>
	);
	let elements: ReactNode;
	switch (onboardingMode?.value) {
		case "new_show":
		case "existing_show":
		case undefined:
			elements = commonFields;
			break;
	}
	return (
		<OnboardingModal
			isOpen
			hasUnsavedChanges={hasUnsavedChanges}
			title={modalTitle}
			headerContent={
				onboardingMode === undefined
					? undefined
					: ({ isSubmitting }) => (
							<SegmentedPicker<ShowOnboardingMode>
								label="Show mode"
								appearance="muted"
								value={onboardingMode.value}
								onChange={onboardingMode.onChange}
								disabled={isSubmitting}
								options={[
									{
										value: "new_show",
										label: "new show",
										tooltip: modeDescriptions.new_show,
									},
									{
										value: "existing_show",
										label: "existing show",
										tooltip: modeDescriptions.existing_show,
									},
								]}
							/>
						)
			}
			onClose={onClose}
			onSubmit={submit}
			cancelLabel="Cancel"
			isSubmitDisabled={pendingTagIds.length > 0}
			{...(submitLabel === undefined ? {} : { submitLabel })}
			{...(submittingLabel === undefined ? {} : { submittingLabel })}
		>
			{onboardingMode !== undefined && (
				<p className={styles.modeDescription}>
					{modeDescriptions[onboardingMode.value]}
				</p>
			)}
			{elements}
		</OnboardingModal>
	);
};
