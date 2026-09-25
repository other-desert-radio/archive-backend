import { useCallback, useEffect, useRef, useState } from "react";
import { loadTags } from "../../loaders/tags.js";
import { LabeledFormControl } from "../shared/labeled-form-control.js";
import { OnboardingModal } from "../shared/onboarding-modal.js";
import {
	TagsInput,
	type TagsInputOption,
	type TagsInputValue,
} from "../shared/tags-input.js";
import { DJImageDropzone } from "./dj-image-dropzone.js";
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
	const [title, setTitle] = useState("");
	const [image, setImage] = useState<File>();
	const [imageError, setImageError] = useState<string>();
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

	useEffect(() => {
		if (!isOpen) return;
		setTitle("");
		setImage(undefined);
		setImageError(undefined);
		setTags({ tags: [], draft: "" });
		setShowTitle("");
		setShowDescription("");
		setSocials("");
		setBio("");
		setImageDropzoneKey((current) => current + 1);
	}, [isOpen]);
	const loadTagOptions = useCallback(() => {
		const version = ++tagRequestVersion.current;
		setIsTagsLoading(true);
		setTagsError(undefined);
		setTagOptions([]);
		loadTags()
			.then((loadedTags) => {
				if (version !== tagRequestVersion.current) return;
				setTagOptions(
					loadedTags.map(({ id, title, color }) => ({ id, title, color })),
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
		<OnboardingModal
			isOpen={isOpen}
			title="Onboard DJ"
			onClose={onClose}
			onSubmit={submit}
		>
			<LabeledFormControl
				id="onboard-dj-title-input"
				name="title"
				label="title"
				value={title}
				onChange={setTitle}
				required
			/>
			<LabeledFormControl
				id="onboard-dj-show-title-input"
				name="showTitle"
				label="show title"
				value={showTitle}
				onChange={setShowTitle}
			/>
			<LabeledFormControl
				id="onboard-dj-show-description-input"
				name="showDescription"
				label="show description"
				value={showDescription}
				onChange={setShowDescription}
				textarea
			/>
			<DJImageDropzone
				key={imageDropzoneKey}
				{...(image === undefined ? {} : { file: image })}
				onFileChange={setImage}
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
			<LabeledFormControl
				id="onboard-dj-socials-input"
				name="socials"
				label="socials"
				value={socials}
				onChange={setSocials}
				textarea
			/>
			<LabeledFormControl
				id="onboard-dj-bio-input"
				name="bio"
				label="bio"
				value={bio}
				onChange={setBio}
				textarea
				required
			/>
		</OnboardingModal>
	);
};
