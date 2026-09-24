import { useRef, useState } from "react";
import { validateDJImageFile } from "./dj-image-utils.js";

type DJImageDropzoneProps = {
	file?: File;
	onFileChange: (file: File | undefined) => void;
	onError: (error: string | undefined) => void;
};

/** Renders the DJ image drag-and-drop area and file-picker fallback. */
export const DJImageDropzone = ({
	file,
	onFileChange,
	onError,
}: DJImageDropzoneProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	/** Validates a selected file and reports it to the modal. */
	const selectFile = (candidate: File | undefined) => {
		if (candidate === undefined) return;
		const result = validateDJImageFile(candidate);
		if (!result.valid) {
			onFileChange(undefined);
			onError(result.error);
			return;
		}
		onError(undefined);
		onFileChange(result.file);
	};

	return (
		<div className="onboarding-modal-field">
			<label htmlFor="onboard-dj-image-input">image</label>
			<section
				aria-label="DJ image upload"
				className={`image-dropzone${isDragging ? " is-dragging" : ""}${
					file === undefined || isDragging ? "" : " has-file"
				}`}
				onDragEnter={(event) => {
					event.preventDefault();
					setIsDragging(true);
				}}
				onDragOver={(event) => event.preventDefault()}
				onDragLeave={() => setIsDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setIsDragging(false);
					selectFile(event.dataTransfer.files[0]);
				}}
			>
				<input
					ref={inputRef}
					id="onboard-dj-image-input"
					name="image"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					hidden
					onChange={(event) => selectFile(event.target.files?.[0])}
				/>
				<button
					type="button"
					className="image-dropzone-button"
					onClick={() => inputRef.current?.click()}
				>
					{isDragging
						? "Drop an image here"
						: file === undefined
							? "Drop an image or choose a file"
							: file.name}
				</button>
			</section>
		</div>
	);
};
