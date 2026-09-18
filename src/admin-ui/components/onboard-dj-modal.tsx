import { logger } from "better-auth";
import { useState } from "react";
import { splitCommaSeparated } from "../../utils/index.js";
import { validateTags } from "../loaders/validate-tags.js";
import { DJImageDropzone } from "./dj-image-dropzone.js";
import { buildCreateDJRequest, type CreateDJForm } from "./onboard-dj-utils.js";

type OnboardDJModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (request: CreateDJForm) => Promise<void>;
};

type FormControlProps = {
	name: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	textarea?: boolean;
};

/**
 * Renders a reusable labeled input or textarea form control.
 *
 * @param props - The field label, value, change handler, and optional blur
 * handler.
 */
export const FormInput = ({
	name,
	label,
	value,
	onChange,
	onBlur,
	textarea = false,
}: FormControlProps) => {
	const id = `onboard-dj-${name}-input`;
	return (
		<div className="modal-field">
			<label htmlFor={id}>{label}</label>
			{textarea ? (
				<textarea
					id={id}
					name={name}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					onBlur={onBlur}
				/>
			) : (
				<input
					id={id}
					name={name}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					onBlur={onBlur}
				/>
			)}
		</div>
	);
};

/**
 * Provides the reusable overlay and panel shell for DJ onboarding.
 *
 * @param props - The modal visibility and close callback.
 */
export const OnboardDJModal = ({
	isOpen,
	onClose,
	onSubmit,
}: OnboardDJModalProps) => {
	const [title, setTitle] = useState("");
	const [image, setImage] = useState<File>();
	const [imageError, setImageError] = useState<string>();
	const [tags, setTags] = useState("");
	const [showTitle, setShowTitle] = useState("");
	const [showDescription, setShowDescription] = useState("");
	const [socials, setSocials] = useState("");
	const [bio, setBio] = useState("");
	const [validationError, setValidationError] = useState<string>();
	const [missingTags, setMissingTags] = useState<string[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	/** Clears missing-tag feedback whenever the tags field is edited. */
	const handleTagsChange = (value: string) => {
		setTags(value);
		setMissingTags([]);
	};

	/** Validates comma-separated tags after the field loses focus. */
	const handleTagsBlur = async () => {
		const submittedTags = splitCommaSeparated(tags);

		if (submittedTags.length === 0) {
			setMissingTags([]);
			return;
		}

		try {
			const result = await validateTags(submittedTags);
			setMissingTags(result.invalid);
		} catch (e) {
			logger.error("error validating tags", e);
			setMissingTags([]);
		}
	};

	/** Validates the form and submits the DJ to the parent callback. */
	const handleSubmit = async () => {
		if (title.trim() === "" || bio.trim() === "") {
			setValidationError("Title and bio are required.");
			return;
		}
		if (imageError !== undefined) {
			setValidationError(imageError);
			return;
		}

		setValidationError(undefined);
		setIsSubmitting(true);

		const request = buildCreateDJRequest({
			title,
			showTitle,
			showDescription,
			tags,
			socials,
			bio,
			...(image === undefined ? {} : { image }),
		});

		try {
			await onSubmit(request);
			onClose();
		} catch (error) {
			setValidationError(
				error instanceof Error
					? error.message
					: "DJ could not be created. Please check the form and image, then try again.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="modal-overlay">
			<div
				className="modal-panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="onboard-dj-title"
			>
				<div className="modal-header">
					<h2 id="onboard-dj-title">Onboard DJ</h2>
					<button type="button" aria-label="Close" onClick={onClose}>
						x
					</button>
				</div>
				<div className="modal-form">
					<FormInput
						name="title"
						label="title"
						value={title}
						onChange={setTitle}
					/>
					<FormInput
						name="showTitle"
						label="show title"
						value={showTitle}
						onChange={setShowTitle}
					/>
					<FormInput
						name="showDescription"
						label="show description"
						value={showDescription}
						onChange={setShowDescription}
						textarea
					/>
					<DJImageDropzone
						{...(image === undefined ? {} : { file: image })}
						onFileChange={setImage}
						onError={setImageError}
					/>
					{imageError !== undefined && (
						<p className="modal-helper modal-error" role="alert">
							{imageError}
						</p>
					)}
					<FormInput
						name="tags"
						label="tags"
						value={tags}
						onChange={handleTagsChange}
						onBlur={handleTagsBlur}
					/>
					{missingTags.length > 0 && (
						<p className="modal-helper">
							These tags will be created after submit: {missingTags.join(", ")}.
						</p>
					)}
					<FormInput
						name="socials"
						label="socials"
						value={socials}
						onChange={setSocials}
						textarea
					/>
					<FormInput
						name="bio"
						label="bio"
						value={bio}
						onChange={setBio}
						textarea
					/>
				</div>
				{validationError !== undefined && (
					<p className="modal-error" role="alert">
						{validationError}
					</p>
				)}
				<button
					type="button"
					className="submit-button"
					onClick={handleSubmit}
					disabled={isSubmitting}
				>
					{isSubmitting ? "Submitting…" : "Submit"}
				</button>
			</div>
		</div>
	);
};
