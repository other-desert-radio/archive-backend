import { useRef, useState } from "react";
import fieldStyles from "../shared/labeled-form-control.module.css";
import styles from "./dj-image-dropzone.module.css";
import { validateDJImageFile } from "./dj-image-utils.js";

type DJImageDropzoneProps = {
	file?: File;
	onFileSelected: (file: File) => Promise<void>;
	onError: (error: string | undefined) => void;
};

/** Renders the DJ image drag-and-drop area and file-picker fallback. */
export const DJImageDropzone = ({
	file,
	onFileSelected,
	onError,
}: DJImageDropzoneProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	/** Validates a selected file and reports it to the modal. */
	const selectFile = async (candidate: File | undefined) => {
		if (candidate === undefined) return;
		const result = validateDJImageFile(candidate);
		if (!result.valid) {
			onError(result.error);
			return;
		}
		onError(undefined);
		await onFileSelected(result.file);
	};

	return (
		<div className={fieldStyles.field}>
			<label htmlFor="onboard-dj-image-input">image</label>
			<section
				aria-label="DJ image upload"
				className={`${styles.dropzone}${isDragging ? ` ${styles.dragging}` : ""}${file === undefined || isDragging ? "" : ` ${styles.hasFile}`}`}
				onDragEnter={(event) => {
					event.preventDefault();
					setIsDragging(true);
				}}
				onDragOver={(event) => event.preventDefault()}
				onDragLeave={() => setIsDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setIsDragging(false);
					void selectFile(event.dataTransfer.files[0]);
				}}
			>
				<input
					ref={inputRef}
					id="onboard-dj-image-input"
					name="image"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					hidden
					onChange={(event) => {
						const input = event.currentTarget;
						void (async () => {
							await selectFile(input.files?.[0]);
							input.value = "";
						})();
					}}
				/>
				<button
					type="button"
					className={styles.button}
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
