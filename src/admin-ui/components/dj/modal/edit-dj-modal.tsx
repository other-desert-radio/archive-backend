import { useCallback, useEffect, useRef, useState } from "react";
import { loadTags } from "../../../loaders/tags.js";
import {
	LabeledFormControl,
	OnboardingModal,
	TagsInput,
	type TagsInputOption,
	type TagsInputValue,
} from "../../shared/modal/index.js";
import {
	DJImageCropModal,
	DJImageDropzone,
	decodeDJImageFile,
} from "../image/index.js";
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
	inheritedTagTitles: string[];
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
	const [title, setTitle] = useState("");
	const [image, setImage] = useState<File>();
	const [imageCandidate, setImageCandidate] = useState<File>();
	const [imageError, setImageError] = useState<string>();
	const [isExistingImageRemoved, setIsExistingImageRemoved] = useState(false);
	const [tags, setTags] = useState<TagsInputValue>({ tags: [], draft: "" });
	const [tagOptions, setTagOptions] = useState<TagsInputOption[]>([]);
	const [isTagsLoading, setIsTagsLoading] = useState(false);
	const [tagsError, setTagsError] = useState<string>();
	const tagRequestVersion = useRef(0);
	const [showTitle, setShowTitle] = useState("");
	const [showDescription, setShowDescription] = useState("");
	const [socials, setSocials] = useState("");
	const [bio, setBio] = useState("");
	const [imageDropzoneKey, setImageDropzoneKey] = useState(0);
	const imageCandidateVersion = useRef(0);

	useEffect(() => {
		if (!isOpen || dj === undefined) return;
		setTitle(dj.title);
		setImage(undefined);
		setImageCandidate(undefined);
		setImageError(undefined);
		setIsExistingImageRemoved(false);
		setTags({ tags: dj.directTagTitles, draft: "" });
		setShowTitle(dj.showTitle ?? "");
		setShowDescription(dj.showDescription ?? "");
		setSocials(dj.socials === undefined ? "" : safeHtmlToPlainText(dj.socials));
		setBio(safeHtmlToPlainText(dj.bio));
		setImageDropzoneKey((current) => current + 1);
	}, [dj, isOpen]);

	const loadTagOptions = useCallback(() => {
		const version = ++tagRequestVersion.current;
		setIsTagsLoading(true);
		setTagsError(undefined);
		setTagOptions([]);
		loadTags()
			.then((loadedTags) => {
				if (version !== tagRequestVersion.current) return;
				setTagOptions(
					loadedTags.map(({ id, title: tagTitle, color }) => ({
						id,
						title: tagTitle,
						color,
					})),
				);
			})
			.catch(() => {
				if (version === tagRequestVersion.current)
					setTagsError("Existing tags could not be loaded.");
			})
			.finally(() => {
				if (version === tagRequestVersion.current) setIsTagsLoading(false);
			});
	}, []);
	useEffect(() => {
		if (!isOpen) return;
		loadTagOptions();
		return () => {
			tagRequestVersion.current += 1;
		};
	}, [isOpen, loadTagOptions]);

	const selectImageCandidate = async (candidate: File) => {
		const version = ++imageCandidateVersion.current;
		setImageError(undefined);
		const result = await decodeDJImageFile(candidate);
		if (version !== imageCandidateVersion.current) return;
		if (!result.valid) {
			setImageError(result.error);
			return;
		}
		setImageCandidate(result.file);
	};
	const cancelImageCandidate = () => {
		imageCandidateVersion.current += 1;
		setImageCandidate(undefined);
	};
	const confirmImageCandidate = (croppedImage: File) => {
		setImage(croppedImage);
		setIsExistingImageRemoved(false);
		cancelImageCandidate();
	};
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
				tags: tags.tags,
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
				isCovered={imageCandidate !== undefined}
				title="Edit DJ"
				onClose={onClose}
				onSubmit={submit}
				submitLabel="Save"
				submittingLabel="Saving…"
				cancelLabel="Cancel"
				isSubmitDisabled={isSubmitDisabled}
				isWide
			>
				<LabeledFormControl
					id="edit-dj-title-input"
					name="title"
					label="title"
					value={title}
					onChange={setTitle}
					required
				/>
				<LabeledFormControl
					id="edit-dj-show-title-input"
					name="showTitle"
					label="show title"
					value={showTitle}
					onChange={setShowTitle}
				/>
				<LabeledFormControl
					id="edit-dj-show-description-input"
					name="showDescription"
					label="show description"
					value={showDescription}
					onChange={setShowDescription}
					textarea
				/>
				{existingImage !== undefined && image === undefined && (
					<div className={styles.imageActions}>
						{isExistingImageRemoved ? (
							<>
								<p>Existing image will be removed when you save.</p>
								<button
									type="button"
									className={styles.imageAction}
									onClick={() => setIsExistingImageRemoved(false)}
								>
									Keep existing image
								</button>
							</>
						) : (
							<>
								<img
									className={styles.currentImage}
									src={existingImage}
									alt={`${dj?.title ?? "DJ"} current`}
								/>
								<button
									type="button"
									className={styles.imageAction}
									onClick={() => setIsExistingImageRemoved(true)}
								>
									Remove existing image
								</button>
							</>
						)}
					</div>
				)}
				<DJImageDropzone
					key={imageDropzoneKey}
					id="edit-dj-image-input"
					label={
						isExistingImageRemoved
							? "add replacement image"
							: existingImage === undefined
								? "image"
								: "replace image"
					}
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
					id="edit-dj-tags-input"
					value={tags}
					onChange={setTags}
					options={tagOptions}
					isLoading={isTagsLoading}
					{...(tagsError === undefined ? {} : { error: tagsError })}
					onRetry={loadTagOptions}
				/>
				{dj !== undefined && dj.inheritedTagTitles.length > 0 && (
					<p>Tags from linked shows: {dj.inheritedTagTitles.join(", ")}</p>
				)}
				<LabeledFormControl
					id="edit-dj-socials-input"
					name="socials"
					label="socials"
					value={socials}
					onChange={setSocials}
					textarea
				/>
				<LabeledFormControl
					id="edit-dj-bio-input"
					name="bio"
					label="bio"
					value={bio}
					onChange={setBio}
					textarea
					required
				/>
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
