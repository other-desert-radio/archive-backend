import { type ReactNode, useEffect, useRef, useState } from "react";
import type { UploadedShowConfirmation } from "../../../../../admin/routes/mixcloud/index.js";
import { uploadMixcloud } from "../../../../loaders/upload-mixcloud.js";
import { MixcloudConnectionBanner } from "../../../mixcloud/connection-banner/index.js";
import {
	commitTagDraft,
	FileDropzone,
	FormModal,
	ImageCropModal,
	ImageDropzone,
	LabeledFormControl,
	TagsInput,
	useImageSelection,
	useTagOptions,
} from "../../../shared/modal/index.js";
import { TracklistEditorModal } from "../../tracklist-editor-modal/index.js";
import { TracklistPreview } from "../../tracklist-preview/index.js";
import type { CreateShowForm } from "../onboard-show-modal/onboard-show-utils.js";
import { ShowDurationField } from "../show-duration-field/index.js";
import {
	buildShowFormRequest,
	type ShowFormValues,
	useShowFormState,
} from "../show-form-state/index.js";
import {
	ShowAssignmentFields,
	ShowRelationshipFields,
} from "../show-relationship-fields/index.js";
import { useSpecialOptions } from "../show-special-field/index.js";
import { ShowTitleDateFields } from "../show-title-date-fields/index.js";
import { generatedMixcloudTitle } from "./generated-mixcloud-title.js";
import styles from "./show-form-modal.module.css";
import { validateShowMP3 } from "./validate-show-mp3.js";

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
} & (
		| {
				onUploaded: (upload: UploadedShowConfirmation) => void;
				onSubmit?: never;
		  }
		| {
				onUploaded?: never;
				onSubmit: (request: CreateShowForm) => Promise<void>;
		  }
	);

/** Shared Show create/edit values, controls, validation, and modal lifecycle. */
export const ShowFormModal = ({
	onUploaded,
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
	const specialOptions = useSpecialOptions();
	const [isTracklistOpen, setTracklistOpen] = useState(false);
	const tracklistOpener = useRef<HTMLButtonElement>(null);
	const uploaded = useRef<UploadedShowConfirmation | undefined>(undefined);
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
		specialOptions.specials.find((special) => special.id === fields.special_id)
			?.title,
	);
	const mixcloudTitle = mixcloudTitleOverride ?? generatedTitle;
	const description = fields.description ?? "";
	const setDescription = (description: string) => {
		setFields((current) => {
			const { description: _description, ...rest } = current;
			return description === "" && initialValues.description === undefined
				? rest
				: { ...current, description };
		});
	};
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
	const isNewShow = onUploaded !== undefined;
	const submit = async () => {
		specialOptions.validate(fields.special_id);
		if (onUploaded !== undefined) {
			if (!mixcloudConnected)
				throw new Error("Sign in to Mixcloud before uploading.");
			if (isDJsLoading || djsError !== undefined)
				throw new Error("DJs must finish loading before submitting.");
			if (
				(fields.selected.length === 0 && fields.special_id == null) ||
				fields.selected.some((id) => !djs.some((dj) => dj.id === id))
			)
				throw new Error("Select existing DJs or a special.");
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
			uploaded.current = await uploadMixcloud({
				title: fields.title.trim(),
				mixcloud_title: mixcloudTitle.trim(),
				date: fields.date,
				djs: fields.selected,
				...(fields.special_id == null ? {} : { special_id: fields.special_id }),
				tags,
				tracklist: fields.tracklist ?? [],
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
	const tracklistField = (
		<>
			{fields.tracklist !== undefined && (
				<div className={styles.tracklistField}>
					<span id={`${idPrefix}-tracklist-label`}>tracklist</span>
					<div>
						{fields.tracklist.length > 0 && (
							<TracklistPreview
								entries={fields.tracklist}
								labelledBy={`${idPrefix}-tracklist-label`}
							/>
						)}
						<button
							type="button"
							ref={tracklistOpener}
							className={`${styles.editTracklist} ${fields.tracklist.length === 0 ? styles.addTracklist : ""}`}
							onClick={() => setTracklistOpen(true)}
						>
							{fields.tracklist.length === 0 ? "Add tracklist" : "edit"}
						</button>
					</div>
				</div>
			)}
		</>
	);
	const commonFields = (
		<>
			<ShowTitleDateFields
				fields={fields}
				setFields={setFields}
				idPrefix={idPrefix}
			/>
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
			{tracklistField}
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
				groupRelationships
				specialOptions={specialOptions}
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
	if (isNewShow) {
		elements = (
			<>
				{mixcloudConnected &&
					(hasUnsavedChanges ||
						mp3 !== undefined ||
						image !== undefined ||
						mixcloudTitleOverride !== undefined) && (
						<div className={styles.mixcloudFields}>
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
							{mixcloudTitleOverride !== undefined && (
								<button
									type="button"
									onClick={() => setMixcloudTitleOverride(undefined)}
								>
									Reset to generated title
								</button>
							)}
						</div>
					)}
				{mixcloudConnected && (
					<>
						<ShowTitleDateFields
							fields={fields}
							setFields={setFields}
							idPrefix={idPrefix}
						>
							<ShowAssignmentFields
								groupRelationships
								fields={fields}
								setFields={setFields}
								idPrefix={idPrefix}
								djs={djs}
								isDJsLoading={isDJsLoading}
								{...(djsError === undefined ? {} : { djsError })}
								onRetryDJs={onRetryDJs}
								specialOptions={specialOptions}
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
						{tracklistField}
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
								className="form-modal-helper form-modal-field-error"
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
				)}
			</>
		);
	} else {
		elements = commonFields;
	}
	return (
		<>
			<FormModal
				isOpen
				hasUnsavedChanges={
					hasUnsavedChanges ||
					mp3 !== undefined ||
					image !== undefined ||
					mixcloudTitleOverride !== undefined
				}
				isCovered={imageCandidate !== undefined || isTracklistOpen}
				title={modalTitle}
				subheading={
					isNewShow ? (
						<MixcloudConnectionBanner onConnected={setMixcloudConnected} />
					) : undefined
				}
				onClose={onClose}
				onSubmit={submit}
				onSubmitted={() => {
					if (uploaded.current && onUploaded) onUploaded(uploaded.current);
					else onClose();
				}}
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
							(fields.selected.length === 0 && fields.special_id == null))) ||
					pendingTagIds.length > 0
				}
				submitLabel={
					submitLabel ?? (isNewShow ? "Upload to Mixcloud" : "Submit")
				}
				submittingLabel={
					submittingLabel ?? (isNewShow ? "Uploading…" : "Submitting…")
				}
			>
				{elements}
			</FormModal>
			{isTracklistOpen && fields.tracklist !== undefined && (
				<TracklistEditorModal
					entries={fields.tracklist}
					onSave={(tracklist) =>
						setFields((current) => ({ ...current, tracklist }))
					}
					onClose={() => {
						setTracklistOpen(false);
						// Restore after the parent has stopped being inert.
						window.setTimeout(() => tracklistOpener.current?.focus());
					}}
				/>
			)}
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
