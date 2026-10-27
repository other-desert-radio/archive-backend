import { useEffect, useRef, useState } from "react";
import type { UploadedShowConfirmation } from "../../../../../admin/routes/mixcloud/index.js";
import type { ShowsAdminRow } from "../../../../loaders/shows.js";
import {
	prepareUploadedShow,
	saveUploadedShow,
	type UploadedShowReview,
} from "../../../../loaders/uploaded-show.js";
import sourceStyles from "../../../mixcloud/onboarding-modal/mixcloud-source-data/mixcloud-source-data.module.css";
import {
	LabeledFormControl,
	MessageModal,
	OnboardingModal,
	SearchableMultiSelect,
} from "../../../shared/modal/index.js";
import { formatDuration } from "../../../shared/resource-views/index.js";
import type { ShowFormOptions } from "../show-form-modal/index.js";
import { useShowFormState } from "../show-form-state/index.js";
import { ShowTitleDateFields } from "../show-title-date-fields/index.js";
import styles from "./uploaded-show-modal.module.css";

export type UploadedShowModalProps = ShowFormOptions & {
	upload: UploadedShowConfirmation;
	onSaved: (show: ShowsAdminRow) => void;
};

/** Announce provider success, then prepare the review without repeating the upload. */
export const UploadedShowModal = (props: UploadedShowModalProps) => {
	const [review, setReview] = useState<UploadedShowReview>();
	const [error, setError] = useState<string>();
	const [request, setRequest] = useState({ uploadId: props.upload.uploadId });
	useEffect(() => {
		let active = true;
		setError(undefined);
		prepareUploadedShow(request.uploadId)
			.then((result) => {
				if (active) setReview(result);
			})
			.catch((error: unknown) => {
				if (active)
					setError(
						error instanceof Error
							? error.message
							: "Unable to load show details.",
					);
			});
		return () => {
			active = false;
		};
	}, [request]);
	if (review) return <ReviewForm {...props} review={review} />;
	return (
		<MessageModal
			title="Uploaded to Mixcloud"
			message="Your show is on Mixcloud. It has not been saved to the archive yet."
			onDismiss={props.onClose}
			primaryAction={{
				label: error ? "Retry loading details" : "Loading show details…",
				disabled: !error,
				onClick: () => setRequest({ uploadId: props.upload.uploadId }),
			}}
			secondaryAction={{ label: "Close", onClick: props.onClose }}
		>
			<p role="status">Uploaded to Mixcloud.</p>
			{error && (
				<p role="alert" className={styles.notice}>
					{error}
				</p>
			)}
		</MessageModal>
	);
};

const ReviewForm = ({
	review,
	djs,
	isDJsLoading,
	djsError,
	onRetryDJs,
	onClose,
	onSaved,
}: UploadedShowModalProps & { review: UploadedShowReview }) => {
	const { editorial, mixcloud } = review;
	const { fields, setFields } = useShowFormState({
		title: editorial.title,
		date: editorial.date,
		selected: editorial.djs,
		duration: String(mixcloud.audio_length),
		mixcloud_image_small: mixcloud.pictures.large,
		mixcloud_image_large: mixcloud.pictures["1024wx1024h"],
		url: mixcloud.url,
		tags: mixcloud.tags.map(({ name }) => ({ title: name })),
		tagDraft: "",
	});
	const [description, setDescription] = useState(editorial.description);
	const saved = useRef<ShowsAdminRow | undefined>(undefined);
	useEffect(() => {
		onRetryDJs();
	}, [onRetryDJs]);
	const submit = async () => {
		if (isDJsLoading || djsError)
			throw new Error("DJs must finish loading before saving.");
		if (!fields.title.trim()) throw new Error("Title is required.");
		if (
			fields.selected.length === 0 ||
			fields.selected.some((id) => !djs.some((dj) => dj.id === id))
		)
			throw new Error("Select at least one existing DJ.");
		saved.current = await saveUploadedShow(review.uploadId, {
			title: fields.title.trim(),
			description,
			date: fields.date,
			djs: fields.selected,
		});
	};
	return (
		<OnboardingModal
			isOpen
			title="Review Show"
			onClose={onClose}
			onSubmit={submit}
			onSubmitted={() => {
				if (saved.current) onSaved(saved.current);
			}}
			hasUnsavedChanges
			allowUnchangedSubmit
			submitLabel="Save Show"
			submittingLabel="Saving…"
			cancelLabel="Close"
			isSubmitDisabled={
				isDJsLoading || djsError !== undefined || fields.selected.length === 0
			}
		>
			<p role="status" className={styles.notice}>
				Uploaded to Mixcloud. Review the details, then save this show to the
				archive.
			</p>
			<ShowTitleDateFields
				fields={fields}
				setFields={setFields}
				idPrefix="uploaded-show"
			>
				<SearchableMultiSelect
					id="uploaded-show-djs"
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
				id="uploaded-show-description"
				name="description"
				label="description"
				value={description}
				onChange={setDescription}
				textarea
				maxLength={1000}
				helper="Changes here affect the archive; your Mixcloud upload stays as uploaded."
			/>
			<section
				className={sourceStyles.section}
				aria-labelledby="uploaded-show-provider-heading"
			>
				<h3 id="uploaded-show-provider-heading">MIXCLOUD DATA</h3>
				<dl>
					<div>
						<dt>Mixcloud title</dt>
						<dd>{mixcloud.name}</dd>
					</div>
					<div>
						<dt>duration</dt>
						<dd>{formatDuration(mixcloud.audio_length)}</dd>
					</div>
					<div>
						<dt>show URL</dt>
						<dd>
							<a href={mixcloud.url} target="_blank" rel="noreferrer">
								{mixcloud.url}
							</a>
						</dd>
					</div>
					<div>
						<dt>tags</dt>
						<dd>
							{mixcloud.tags.map(({ name }) => name).join(", ") || "None"}
						</dd>
					</div>
					<div>
						<dt>small image URL</dt>
						<dd>
							<a
								href={mixcloud.pictures.large}
								target="_blank"
								rel="noreferrer"
							>
								{mixcloud.pictures.large}
							</a>
						</dd>
					</div>
					<div>
						<dt>large image URL</dt>
						<dd>
							<a
								href={mixcloud.pictures["1024wx1024h"]}
								target="_blank"
								rel="noreferrer"
							>
								{mixcloud.pictures["1024wx1024h"]}
							</a>
						</dd>
					</div>
				</dl>
				<img
					className={styles.preview}
					src={mixcloud.pictures.large}
					alt="Uploaded show cover"
				/>
			</section>
			<p className={styles.notice}>
				Closing leaves this show on Mixcloud without adding it to the archive.
				Resuming after closing is not available yet.
			</p>
		</OnboardingModal>
	);
};
