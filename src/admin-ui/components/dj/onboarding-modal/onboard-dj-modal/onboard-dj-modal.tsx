import { useEffect, useRef, useState } from "react";
import {
	hasFormChanges,
	OnboardingModal,
	TagsInput,
	type TagsInputValue,
	useTagOptions,
} from "../../../shared/modal/index.js";
import {
	DJImageCropModal,
	DJImageDropzone,
	useDJImageSelection,
} from "../../image/index.js";
import { DJMetadataFields } from "../dj-metadata-fields/index.js";
import { buildCreateDJRequest, type CreateDJForm } from "./onboard-dj-utils.js";

type OnboardDJModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (request: CreateDJForm) => Promise<void>;
};

/** Supplies DJ-specific values and validation to the shared onboarding modal. */
export const OnboardDJModal = ({
	isOpen,
	onClose,
	onSubmit,
}: OnboardDJModalProps) => {
	const { tagOptions, isTagsLoading, tagsError, loadTagOptions } =
		useTagOptions(isOpen);
	const {
		image,
		imageCandidate,
		imageError,
		setImageError,
		imageDropzoneKey,
		selectImageCandidate,
		cancelImageCandidate,
		confirmImageCandidate,
	} = useDJImageSelection(isOpen);
	const initialValues = useRef({
		title: "",
		bio: "",
		socials: "",
		showTitle: "",
		showDescription: "",
		tags: [] as string[],
		tagDraft: "",
		image: undefined as File | undefined,
	});
	const [title, setTitle] = useState("");
	const [tags, setTags] = useState<TagsInputValue>({ tags: [], draft: "" });
	const [showTitle, setShowTitle] = useState("");
	const [showDescription, setShowDescription] = useState("");
	const [socials, setSocials] = useState("");
	const [bio, setBio] = useState("");

	useEffect(() => {
		if (!isOpen) return;
		initialValues.current = {
			title: "",
			bio: "",
			socials: "",
			showTitle: "",
			showDescription: "",
			tags: [] as string[],
			tagDraft: "",
			image: undefined as File | undefined,
		};
		setTitle("");
		setTags({ tags: [], draft: "" });
		setShowTitle("");
		setShowDescription("");
		setSocials("");
		setBio("");
	}, [isOpen]);

	const submit = async () => {
		if (title.trim() === "" || bio.trim() === "") {
			throw new Error("Title and bio are required.");
		}
		if (imageError !== undefined) throw new Error(imageError);
		await onSubmit(
			buildCreateDJRequest({
				title,
				showTitle,
				showDescription,
				tags: tags.tags,
				tagDraft: tags.draft,
				socials,
				bio,
				...(image === undefined ? {} : { image }),
			}),
		);
	};

	return (
		<>
			<OnboardingModal
				isOpen={isOpen}
				hasUnsavedChanges={hasFormChanges(
					{
						title,
						bio,
						socials,
						showTitle,
						showDescription,
						tags: tags.tags,
						tagDraft: tags.draft,
						image,
					},
					initialValues.current,
				)}
				isCovered={imageCandidate !== undefined}
				title="Onboard DJ"
				onClose={onClose}
				onSubmit={submit}
				cancelLabel="Cancel"
			>
				<DJMetadataFields
					idPrefix="onboard-dj"
					title={{ value: title, onChange: setTitle }}
					showTitle={{ value: showTitle, onChange: setShowTitle }}
					showDescription={{
						value: showDescription,
						onChange: setShowDescription,
					}}
					socials={{ value: socials, onChange: setSocials }}
					bio={{ value: bio, onChange: setBio }}
				>
					<DJImageDropzone
						key={imageDropzoneKey}
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
					<TagsInput
						id="onboard-dj-tags-input"
						value={tags}
						onChange={setTags}
						options={tagOptions}
						isLoading={isTagsLoading}
						{...(tagsError === undefined ? {} : { error: tagsError })}
						onRetry={loadTagOptions}
					/>
				</DJMetadataFields>
			</OnboardingModal>
			{imageCandidate !== undefined && (
				<DJImageCropModal
					file={imageCandidate}
					onCancel={cancelImageCandidate}
					onConfirm={confirmImageCandidate}
				/>
			)}
		</>
	);
};
