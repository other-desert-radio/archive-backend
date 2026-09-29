import { useRef, useState } from "react";
import fieldStyles from "../../../shared/modal/labeled-form-control/labeled-form-control.module.css";
import { validateDJImageFile } from "../utils/index.js";
import styles from "./dj-image-dropzone.module.css";

type DJImageDropzoneProps = {
	id?: string;
	label?: string;
	file?: File;
	compact?: boolean;
	buttonLabel?: string;
	showLabel?: boolean;
	onFileSelected: (file: File) => Promise<void>;
	onError: (error: string | undefined) => void;
};

/** Renders the DJ image drag-and-drop area and file-picker fallback. */
export const DJImageDropzone = ({
	id = "onboard-dj-image-input",
	label = "image",
	file,
	compact = false,
	buttonLabel,
	showLabel = true,
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

	const uploadControl = (
		<section
			aria-label="DJ image upload"
			className={`${styles.dropzone}${compact ? ` ${styles.compact}` : ""}${isDragging ? ` ${styles.dragging}` : ""}${file === undefined || isDragging ? "" : ` ${styles.hasFile}`}`}
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
				id={id}
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
				className={compact ? styles.compactButton : styles.button}
				onClick={() => inputRef.current?.click()}
			>
				{isDragging
					? "Drop an image here"
					: (buttonLabel ??
						(file === undefined
							? "Drop an image or choose a file"
							: file.name))}
			</button>
		</section>
	);

	if (compact) return uploadControl;

	return (
		<div className={fieldStyles.field}>
			{showLabel && <label htmlFor={id}>{label}</label>}
			{uploadControl}
		</div>
	);
};
