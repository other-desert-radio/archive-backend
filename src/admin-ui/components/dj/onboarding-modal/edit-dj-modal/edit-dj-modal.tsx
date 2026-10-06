import { useEffect, useRef, useState } from "react";
import {
	hasFormChanges,
	OnboardingModal,
	TagsInput,
	type TagsInputOption,
	type TagsInputValue,
	useTagOptions,
} from "../../../shared/modal/index.js";
import { Tag, TagsContainer } from "../../../shared/resource-views/index.js";
import { DJImageCropModal, useDJImageSelection } from "../../image/index.js";
import { DJMetadataFields } from "../dj-metadata-fields/index.js";
import { EditDJImageField } from "../edit-dj-image-field/index.js";
import styles from "./edit-dj-modal.module.css";
import {
	buildEditDJRequest,
	type EditDJForm,
	safeHtmlToPlainText,
} from "./edit-dj-utils.js";

export type EditDJModalValues = {
	id: number;
	title: string;
	bio: string;
	socials?: string;
	showTitle?: string;
	showDescription?: string;
	image?: string;
	directTagTitles: string[];
	inheritedTags: TagsInputOption[];
};

type EditDJModalProps = {
	isOpen: boolean;
	dj: EditDJModalValues | undefined;
	onClose: () => void;
	onSubmit: (request: EditDJForm) => Promise<void>;
	isSubmitDisabled?: boolean;
};

/** Edits a DJ using the shared modal shell and existing image-cropping flow. */
export const EditDJModal = ({
	isOpen,
	dj,
	onClose,
	onSubmit,
	isSubmitDisabled = false,
}: EditDJModalProps) => {
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
		isExistingImageRemoved,
		setIsExistingImageRemoved,
	} = useDJImageSelection(isOpen, dj);
	const initialValues = useRef({
		title: "",
		bio: "",
		socials: "",
		showTitle: "",
		showDescription: "",
		tags: [] as string[],
		tagDraft: "",
		image: undefined as File | undefined,
		removeImage: false,
	});
	const [title, setTitle] = useState("");
	const [tags, setTags] = useState<TagsInputValue>({ tags: [], draft: "" });
	const [showTitle, setShowTitle] = useState("");
	const [showDescription, setShowDescription] = useState("");
	const [socials, setSocials] = useState("");
	const [bio, setBio] = useState("");

	useEffect(() => {
		if (!isOpen || dj === undefined) return;
		initialValues.current = {
			title: dj.title,
			bio: safeHtmlToPlainText(dj.bio),
			socials: dj.socials === undefined ? "" : safeHtmlToPlainText(dj.socials),
			showTitle: dj.showTitle ?? "",
			showDescription: dj.showDescription ?? "",
			tags: dj.directTagTitles,
			tagDraft: "",
			image: undefined,
			removeImage: false,
		};
		setTitle(dj.title);
		setTags({
			tags: dj.directTagTitles.map((title) => ({ title })),
			draft: "",
		});
		setShowTitle(dj.showTitle ?? "");
		setShowDescription(dj.showDescription ?? "");
		setSocials(dj.socials === undefined ? "" : safeHtmlToPlainText(dj.socials));
		setBio(safeHtmlToPlainText(dj.bio));
	}, [dj, isOpen]);

	const submit = async () => {
		if (dj === undefined) throw new Error("The DJ could not be loaded.");
		if (title.trim() === "" || bio.trim() === "")
			throw new Error("Title and bio are required.");
		if (imageError !== undefined) throw new Error(imageError);
		await onSubmit(
			buildEditDJRequest({
				id: dj.id,
				title,
				bio,
				tags: tags.tags.map(({ title }) => title),
				tagDraft: tags.draft,
				socials,
				showTitle,
				showDescription,
				...(image === undefined ? {} : { image }),
				removeImage: isExistingImageRemoved,
			}),
		);
	};
	const existingImage = dj?.image;

	return (
		<>
			<OnboardingModal
				isOpen={isOpen && dj !== undefined}
				hasUnsavedChanges={hasFormChanges(
					{
						title,
						bio,
						socials,
						showTitle,
						showDescription,
						tags: tags.tags.map(({ title }) => title),
						tagDraft: tags.draft,
						image,
						removeImage: isExistingImageRemoved,
					},
					initialValues.current,
				)}
				isCovered={imageCandidate !== undefined}
				title="Edit DJ"
				onClose={onClose}
				onSubmit={submit}
				submitLabel="Save"
				submittingLabel="Saving…"
				cancelLabel="Cancel"
				isSubmitDisabled={isSubmitDisabled}
			>
				<DJMetadataFields
					idPrefix="edit-dj"
					title={{ value: title, onChange: setTitle }}
					showTitle={{ value: showTitle, onChange: setShowTitle }}
					showDescription={{
						value: showDescription,
						onChange: setShowDescription,
					}}
					socials={{ value: socials, onChange: setSocials }}
					bio={{ value: bio, onChange: setBio }}
				>
					<EditDJImageField
						title={dj?.title ?? "DJ"}
						existingImage={existingImage}
						image={image}
						imageError={imageError}
						isExistingImageRemoved={isExistingImageRemoved}
						imageDropzoneKey={imageDropzoneKey}
						selectImageCandidate={selectImageCandidate}
						setImageError={setImageError}
						setIsExistingImageRemoved={setIsExistingImageRemoved}
					/>
					<TagsInput
						id="edit-dj-tags-input"
						value={tags}
						onChange={setTags}
						options={tagOptions}
						isLoading={isTagsLoading}
						{...(tagsError === undefined ? {} : { error: tagsError })}
						onRetry={loadTagOptions}
					/>
					{dj !== undefined && dj.inheritedTags.length > 0 && (
						<div className={styles.inheritedTags}>
							<p>Tags from linked shows</p>
							<div className={styles.inheritedTagsList}>
								<TagsContainer label="Tags from linked shows">
									{dj.inheritedTags.map((tag) => (
										<Tag key={tag.id} color={tag.color}>
											{tag.title}
										</Tag>
									))}
								</TagsContainer>
							</div>
						</div>
					)}
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
