import { useEffect, useRef, useState } from "react";
import fieldStyles from "../labeled-form-control/labeled-form-control.module.css";
import styles from "./file-dropzone.module.css";

type FileDropzoneProps = {
	id?: string;
	accept: string;
	name: string;
	preview?: boolean;
	style?: "square" | "horizontal";
	validateFile: (
		file: File,
	) => { valid: true; file: File } | { valid: false; error: string };
	label?: string;
	file?: File;
	compact?: boolean;
	buttonLabel?: string;
	showLabel?: boolean;
	onFileSelected: (file: File) => Promise<void>;
	onError: (error: string | undefined) => void;
};

/** Renders a shared drag-and-drop area and file-picker fallback. */
export const FileDropzone = ({
	id = "file-input",
	accept,
	name,
	preview = false,
	style,
	validateFile,
	label = "file",
	file,
	compact = false,
	buttonLabel,
	showLabel = true,
	onFileSelected,
	onError,
}: FileDropzoneProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string>();

	useEffect(() => {
		if (file === undefined || !preview) {
			setPreviewUrl(undefined);
			return;
		}
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file, preview]);

	/** Validates a selected file and reports it to the modal. */
	const selectFile = async (candidate: File | undefined) => {
		if (candidate === undefined) return;
		const result = validateFile(candidate);
		if (!result.valid) {
			onError(result.error);
			return;
		}
		onError(undefined);
		await onFileSelected(result.file);
	};

	const uploadControl = (
		<section
			aria-label={`${label} upload`}
			className={`${styles.dropzone}${style === undefined ? "" : ` ${styles[style]}`}${compact ? ` ${styles.compact}` : ""}${isDragging ? ` ${styles.dragging}` : ""}${file === undefined || isDragging ? "" : ` ${styles.hasFile}`}`}
			onDragEnter={(event) => {
				event.preventDefault();
				setIsDragging(true);
			}}
			onDragOver={(event) => event.preventDefault()}
			onDragLeave={() => setIsDragging(false)}
			onDrop={(event) => {
				event.preventDefault();
				setIsDragging(false);
				if (event.dataTransfer.files.length !== 1) {
					onError("Choose one file at a time.");
					return;
				}
				void selectFile(event.dataTransfer.files[0]);
			}}
		>
			{previewUrl !== undefined && !compact && (
				<img
					className={styles.preview}
					src={previewUrl}
					alt="Selected preview"
				/>
			)}
			<input
				ref={inputRef}
				id={id}
				name={name}
				type="file"
				accept={accept}
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
					? `Drop ${label} here`
					: (buttonLabel ??
						(file === undefined
							? `Drop ${label} or choose a file`
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
