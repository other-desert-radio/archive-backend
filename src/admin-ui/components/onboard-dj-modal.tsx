import { useState } from "react";

type OnboardDJModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

type FormControlProps = {
	name: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	textarea?: boolean;
};

// TODO: Use CreateDJRequest from ../../admin/routes/djs/index.js for the submit payload.

/** Renders a reusable labeled input or textarea form control. */
export const FormInput = ({
	name,
	label,
	value,
	onChange,
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
				/>
			) : (
				<input
					id={id}
					name={name}
					value={value}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
		</div>
	);
};

/** Provides the reusable overlay and panel shell for DJ onboarding. */
export const OnboardDJModal = ({ isOpen, onClose }: OnboardDJModalProps) => {
	const [title, setTitle] = useState("");
	const [image, setImage] = useState("");
	const [tags, setTags] = useState("");
	const [socials, setSocials] = useState("");
	const [bio, setBio] = useState("");
	const [validationError, setValidationError] = useState<string>();

	const handleSubmit = () => {
		if (title.trim() === "" || bio.trim() === "") {
			setValidationError("Title and bio are required.");
			return;
		}
		setValidationError(undefined);
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
						name="image"
						label="image"
						value={image}
						onChange={setImage}
					/>
					<FormInput name="tags" label="tags" value={tags} onChange={setTags} />
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
				<button type="button" className="submit-button" onClick={handleSubmit}>
					Submit
				</button>
			</div>
		</div>
	);
};
