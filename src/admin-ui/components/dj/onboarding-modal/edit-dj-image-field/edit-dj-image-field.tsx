import fieldStyles from "../../../shared/modal/labeled-form-control/labeled-form-control.module.css";
import { DJImageDropzone } from "../../image/index.js";
import styles from "./edit-dj-image-field.module.css";

type Props = {
	title: string;
	existingImage: string | undefined;
	image: File | undefined;
	imageError: string | undefined;
	isExistingImageRemoved: boolean;
	imageDropzoneKey: number;
	selectImageCandidate: (file: File) => Promise<void>;
	setImageError: (error: string | undefined) => void;
	setIsExistingImageRemoved: (removed: boolean) => void;
};

export const EditDJImageField = ({
	title,
	existingImage,
	image,
	imageError,
	isExistingImageRemoved,
	imageDropzoneKey,
	selectImageCandidate,
	setImageError,
	setIsExistingImageRemoved,
}: Props) => (
	<div className={fieldStyles.field}>
		<label htmlFor="edit-dj-image-input">image</label>
		<div className={styles.imageField}>
			{existingImage !== undefined &&
				image === undefined &&
				!isExistingImageRemoved && (
					<div className={styles.imageActions}>
						<img
							className={styles.currentImage}
							src={existingImage}
							alt={`${title} current`}
						/>
						<DJImageDropzone
							key={imageDropzoneKey}
							id="edit-dj-image-input"
							compact
							buttonLabel="Replace"
							onFileSelected={selectImageCandidate}
							onError={setImageError}
						/>
						<button
							type="button"
							className={styles.imageAction}
							onClick={() => setIsExistingImageRemoved(true)}
						>
							Remove
						</button>
					</div>
				)}
			{(existingImage === undefined ||
				image !== undefined ||
				isExistingImageRemoved) && (
				<div className={styles.imageUploadActions}>
					<DJImageDropzone
						key={imageDropzoneKey}
						id="edit-dj-image-input"
						showLabel={false}
						{...(image === undefined ? {} : { file: image })}
						onFileSelected={selectImageCandidate}
						onError={setImageError}
					/>
					{isExistingImageRemoved && (
						<button
							type="button"
							className={styles.imageAction}
							onClick={() => setIsExistingImageRemoved(false)}
						>
							Undo
						</button>
					)}
				</div>
			)}
			{isExistingImageRemoved && (
				<p className={fieldStyles.helper}>
					Existing image will be removed when you save.
				</p>
			)}
			{imageError !== undefined && (
				<p className={styles.imageError} role="alert">
					{imageError}
				</p>
			)}
		</div>
	</div>
);
