import { type ReactNode, useEffect, useState } from "react";
import { loadMixcloudConnection } from "../../../../loaders/mixcloud-connection.js";
import { uploadMixcloud } from "../../../../loaders/upload-mixcloud.js";
import sourceStyles from "../../../mixcloud/onboarding-modal/mixcloud-source-data/mixcloud-source-data.module.css";
import {
	commitTagDraft,
	FileDropzone,
	ImageCropModal,
	ImageDropzone,
	LabeledFormControl,
	OnboardingModal,
	SearchableMultiSelect,
	TagsInput,
	useImageSelection,
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
import { generatedMixcloudTitle } from "./generated-mixcloud-title.js";
import styles from "./show-form-modal.module.css";
import { validateShowMP3 } from "./validate-show-mp3.js";

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

/** Loads identity only; upload credentials stay on the server. */
const MixcloudSignInText = ({
	onConnected,
}: {
	onConnected: (connected: boolean) => void;
}) => {
	const [text, setText] = useState<ReactNode>("Checking Mixcloud sign-in…");
	useEffect(() => {
		let active = true;
		loadMixcloudConnection()
			.then((status) => {
				if (!active) return;
				onConnected(status.connected);
				setText(
					status.connected ? (
						<>
							Signed in as <strong>{status.account.displayName}</strong>
						</>
					) : status.configured ? (
						"Not signed in via Mixcloud."
					) : (
						"Mixcloud is not configured."
					),
				);
			})
			.catch(() => {
				if (active) setText("Unable to check Mixcloud sign-in.");
			});
		return () => {
			active = false;
		};
	}, [onConnected]);
	return (
		<p className={styles.mixcloudStatus} role="status">
			{text}
		</p>
	);
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
	const [mixcloudConnected, setMixcloudConnected] = useState(false);
	const {
		image,
		imageCandidate,
		imageError,
		setImageError,
		imageDropzoneKey,
		selectImageCandidate,
		cancelImageCandidate,
		confirmImageCandidate,
		removeImage,
	} = useImageSelection(true);
	const [mixcloudTitleOverride, setMixcloudTitleOverride] = useState<string>();
	const generatedTitle = generatedMixcloudTitle(
		fields.selected.flatMap((id) => {
			const dj = djs.find((dj) => dj.id === id);
			return dj === undefined ? [] : [dj.title];
		}),
		fields.title,
		fields.date,
	);
	const mixcloudTitle = mixcloudTitleOverride ?? generatedTitle;
	const [description, setDescription] = useState("");
	const [mp3, setMP3] = useState<File>();
	const [mp3Error, setMP3Error] = useState<string>();
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
	const { mixcloud_image_small, mixcloud_image_large, url } = fields;
	const isNewShow = onboardingMode?.value === "new_show";
	const submit = async () => {
		if (isNewShow) {
			if (!mixcloudConnected)
				throw new Error("Sign in to Mixcloud before uploading.");
			if (isDJsLoading || djsError !== undefined)
				throw new Error("DJs must finish loading before submitting.");
			if (
				fields.selected.length === 0 ||
				fields.selected.some((id) => !djs.some((dj) => dj.id === id))
			)
				throw new Error("Select at least one DJ.");
			if (!fields.title.trim() || !mixcloudTitle.trim())
				throw new Error("Show title and Mixcloud title are required.");
			if (description.length > 1000)
				throw new Error("Description must be at most 1000 characters.");
			if (!fields.date) throw new Error("Show date is required.");
			if (image === undefined) throw new Error("Choose a show image.");
			if (mp3 === undefined) throw new Error("Choose an MP3 file.");
			const tags = commitTagDraft(
				fields.tags.map(({ title }) => title),
				fields.tagDraft,
			);
			if (tags.length > 5) throw new Error("Mixcloud accepts up to five tags.");
			await uploadMixcloud({
				title: fields.title.trim(),
				mixcloud_title: mixcloudTitle.trim(),
				date: fields.date,
				tags,
				mp3,
				description,
				image,
			});
			return;
		}
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
				name="mixcloud_image_small"
				label="small image URL"
				type="url"
				value={mixcloud_image_small}
				onChange={(mixcloud_image_small) =>
					setFields({ ...fields, mixcloud_image_small })
				}
				required
			/>
			<LabeledFormControl
				id={`${idPrefix}-image-large`}
				name="mixcloud_image_large"
				label="large image URL"
				type="url"
				value={mixcloud_image_large}
				onChange={(mixcloud_image_large) =>
					setFields({ ...fields, mixcloud_image_large })
				}
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
			elements = (
				<>
					<section
						className={sourceStyles.section}
						aria-labelledby={`${idPrefix}-mixcloud-data`}
					>
						<h3 id={`${idPrefix}-mixcloud-data`}>MIXCLOUD</h3>
						<MixcloudSignInText onConnected={setMixcloudConnected} />
						{(hasUnsavedChanges ||
							description !== "" ||
							mp3 !== undefined ||
							image !== undefined ||
							mixcloudTitleOverride !== undefined) && (
							<div
								className={styles.mixcloudTitle}
								data-generated={mixcloudTitleOverride === undefined}
							>
								<LabeledFormControl
									id={`${idPrefix}-mixcloud-title`}
									name="mixcloud_title"
									label="Mixcloud title"
									helper="Title to be sent to Mixcloud. This is auto generated using the existing format. Click to edit"
									value={mixcloudTitle}
									onChange={setMixcloudTitleOverride}
									required
								/>
							</div>
						)}
						{mixcloudTitleOverride !== undefined && (
							<button
								type="button"
								onClick={() => setMixcloudTitleOverride(undefined)}
							>
								Reset to generated title
							</button>
						)}
					</section>
					<ShowTitleDateFields
						fields={fields}
						setFields={setFields}
						idPrefix={idPrefix}
					>
						<SearchableMultiSelect
							id={`${idPrefix}-djs`}
							label="DJs"
							options={djs.map((dj) => ({
								id: dj.id,
								label: dj.title,
								searchText: `${dj.title} ${dj.id}`,
							}))}
							selectedIds={fields.selected}
							onChange={(selected) => setFields({ ...fields, selected })}
							isLoading={isDJsLoading}
							{...(djsError === undefined ? {} : { error: djsError })}
							onRetry={onRetryDJs}
						/>
					</ShowTitleDateFields>
					<LabeledFormControl
						id={`${idPrefix}-description`}
						name="description"
						label="description"
						value={description}
						onChange={setDescription}
						textarea
						maxLength={1000}
						helper="Up to 1000 characters."
					/>
					<TagsInput
						id={`${idPrefix}-tags`}
						value={{ tags: fields.tags, draft: fields.tagDraft }}
						onChange={({ tags, draft }) =>
							setFields({ ...fields, tags, tagDraft: draft })
						}
						options={tagOptions}
						isLoading={isTagsLoading}
						{...(tagError === undefined ? {} : { error: tagError })}
						onRetry={loadTagOptions}
					/>
					<ImageDropzone
						key={imageDropzoneKey}
						id={`${idPrefix}-image`}
						name="image"
						{...(image === undefined ? {} : { file: image })}
						onFileSelected={selectImageCandidate}
						onError={setImageError}
					/>
					{imageError !== undefined && (
						<p
							className="onboarding-modal-helper onboarding-modal-field-error"
							role="alert"
						>
							{imageError}
						</p>
					)}
					{image !== undefined && (
						<div className={styles.uploadMessage}>
							<button type="button" onClick={removeImage}>
								Remove image
							</button>
						</div>
					)}
					<FileDropzone
						id={`${idPrefix}-mp3`}
						label="MP3"
						name="mp3"
						accept=".mp3,audio/mpeg"
						buttonLabel={
							mp3 === undefined
								? "Drop MP3 or choose file"
								: `${mp3.name} (${(mp3.size / 1_000_000).toFixed(2)} MB)`
						}
						{...(mp3 === undefined ? {} : { file: mp3 })}
						validateFile={validateShowMP3}
						onFileSelected={async (file) => setMP3(file)}
						onError={setMP3Error}
					/>
					{mp3Error !== undefined && (
						<p className={styles.uploadMessage} role="alert">
							{mp3Error}
						</p>
					)}
					{mp3 !== undefined && (
						<div className={styles.uploadMessage}>
							<button
								type="button"
								onClick={() => {
									setMP3(undefined);
									setMP3Error(undefined);
								}}
							>
								Remove MP3
							</button>
						</div>
					)}
				</>
			);
			break;
		case "existing_show":
		case undefined:
			elements = commonFields;
			break;
	}
	return (
		<>
			<OnboardingModal
				isOpen
				hasUnsavedChanges={
					hasUnsavedChanges ||
					mp3 !== undefined ||
					image !== undefined ||
					description !== "" ||
					mixcloudTitleOverride !== undefined
				}
				isCovered={imageCandidate !== undefined}
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
				isSubmitDisabled={
					(isNewShow &&
						(!mixcloudConnected ||
							mp3 === undefined ||
							image === undefined ||
							!fields.title.trim() ||
							!mixcloudTitle.trim() ||
							!fields.date ||
							isDJsLoading ||
							djsError !== undefined ||
							fields.selected.length === 0)) ||
					pendingTagIds.length > 0
				}
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
			{imageCandidate !== undefined && (
				<ImageCropModal
					file={imageCandidate}
					onCancel={cancelImageCandidate}
					onConfirm={confirmImageCandidate}
				/>
			)}
		</>
	);
};
