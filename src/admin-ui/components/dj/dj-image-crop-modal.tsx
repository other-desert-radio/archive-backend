import { useEffect, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import styles from "./dj-image-crop-modal.module.css";
import {
	cropDJImage,
	type DJImageRotation,
	rotateDJImage,
} from "./dj-image-crop-utils.js";
import { validateDJImageFile } from "./dj-image-utils.js";

type DJImageCropModalProps = {
	file: File;
	onCancel: () => void;
	onConfirm: (file: File) => void;
};

const getFocusableElements = (panel: HTMLElement) =>
	Array.from(
		panel.querySelectorAll<HTMLElement>(
			'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hasAttribute("hidden"));

/** Lets an admin position and zoom a square crop before keeping the image. */
export const DJImageCropModal = ({
	file,
	onCancel,
	onConfirm,
}: DJImageCropModalProps) => {
	const panelRef = useRef<HTMLDivElement>(null);
	const openerRef = useRef<HTMLElement | undefined>(undefined);
	const [objectUrl, setObjectUrl] = useState("");
	const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [rotation, setRotation] = useState<DJImageRotation>(0);
	const [area, setArea] = useState<Area>();
	const [error, setError] = useState<string>();
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		openerRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;
		const url = URL.createObjectURL(file);
		setObjectUrl(url);
		const focusTimer = window.setTimeout(() =>
			getFocusableElements(panelRef.current ?? document.body)[0]?.focus(),
		);
		return () => {
			window.clearTimeout(focusTimer);
			URL.revokeObjectURL(url);
			openerRef.current?.focus();
		};
	}, [file]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !isSaving) {
				event.preventDefault();
				onCancel();
				return;
			}
			if (event.key !== "Tab") return;
			const focusable = getFocusableElements(panelRef.current ?? document.body);
			const first = focusable[0];
			const last = focusable.at(-1);
			if (first === undefined || last === undefined) return;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isSaving, onCancel]);

	const confirm = async () => {
		if (area === undefined) return;
		setError(undefined);
		setIsSaving(true);
		try {
			const cropped = await cropDJImage(file, area, rotation);
			const validation = validateDJImageFile(cropped);
			if (!validation.valid) throw new Error(validation.error);
			onConfirm(validation.file);
		} catch (cropError) {
			setError(
				cropError instanceof Error
					? cropError.message
					: "Image could not be prepared",
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className={styles.overlay}>
			<div
				ref={panelRef}
				className={styles.panel}
				role="dialog"
				aria-modal="true"
				aria-labelledby="dj-image-crop-title"
				tabIndex={-1}
			>
				<div className={styles.header}>
					<h2 id="dj-image-crop-title">Crop image</h2>
				</div>
				<div className={styles.preview}>
					{objectUrl !== "" && (
						<Cropper
							image={objectUrl}
							crop={crop}
							zoom={zoom}
							rotation={rotation}
							aspect={1}
							showGrid={false}
							onCropChange={setCrop}
							onCropComplete={(_, pixels) => setArea(pixels)}
							onZoomChange={setZoom}
						/>
					)}
				</div>
				<div className={styles.controls}>
					<label htmlFor="dj-image-crop-zoom">Zoom</label>
					<input
						id="dj-image-crop-zoom"
						type="range"
						min="1"
						max="3"
						step="0.01"
						value={zoom}
						onChange={(event) => setZoom(Number(event.target.value))}
						disabled={isSaving}
					/>
					<span id="dj-image-crop-rotation">Rotate</span>
					<div className={styles.rotationControls}>
						<button
							type="button"
							onClick={() =>
								setRotation((current) => rotateDJImage(current, -90))
							}
							disabled={isSaving}
						>
							Rotate left
						</button>
						<button
							type="button"
							onClick={() =>
								setRotation((current) => rotateDJImage(current, 90))
							}
							disabled={isSaving}
						>
							Rotate right
						</button>
					</div>
				</div>
				{error !== undefined && (
					<p className={styles.error} role="alert">
						{error}
					</p>
				)}
				<div className={styles.actions}>
					<button type="button" onClick={onCancel} disabled={isSaving}>
						Cancel
					</button>
					<button
						type="button"
						onClick={confirm}
						disabled={isSaving || area === undefined}
					>
						{isSaving ? "Preparing…" : "Use image"}
					</button>
				</div>
			</div>
		</div>
	);
};
