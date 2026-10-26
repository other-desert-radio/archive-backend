import { useCallback, useEffect, useRef, useState } from "react";
import { decodeImageFile } from "../utils/index.js";

/** Owns decoded candidates, accepted crops, removal and cancellation cleanup. */
export const useImageSelection = (
	isOpen: boolean,
	resetKey: unknown = null,
) => {
	const [image, setImage] = useState<File>();
	const [imageCandidate, setImageCandidate] = useState<File>();
	const [imageError, setImageError] = useState<string>();
	const [isExistingImageRemoved, setIsExistingImageRemoved] = useState(false);
	const [imageDropzoneKey, setImageDropzoneKey] = useState(0);
	const imageCandidateVersion = useRef(0);
	useEffect(() => {
		if (!isOpen || resetKey === undefined) return;
		setImage(undefined);
		setImageCandidate(undefined);
		setImageError(undefined);
		setIsExistingImageRemoved(false);
		setImageDropzoneKey((current) => current + 1);
		return () => {
			imageCandidateVersion.current += 1;
		};
	}, [isOpen, resetKey]);
	const selectImageCandidate = async (candidate: File) => {
		const version = ++imageCandidateVersion.current;
		setImageError(undefined);
		const result = await decodeImageFile(candidate);
		if (version !== imageCandidateVersion.current) return;
		if (!result.valid) {
			setImageError(result.error);
			return;
		}
		setImageCandidate(result.file);
	};
	const cancelImageCandidate = useCallback(() => {
		imageCandidateVersion.current += 1;
		setImageCandidate(undefined);
	}, []);
	const confirmImageCandidate = (croppedImage: File) => {
		setImage(croppedImage);
		setIsExistingImageRemoved(false);
		cancelImageCandidate();
	};
	const removeImage = () => {
		cancelImageCandidate();
		setImage(undefined);
		setImageError(undefined);
		setImageDropzoneKey((current) => current + 1);
	};
	return {
		removeImage,
		image,
		imageCandidate,
		imageError,
		setImageError,
		isExistingImageRemoved,
		setIsExistingImageRemoved,
		imageDropzoneKey,
		selectImageCandidate,
		cancelImageCandidate,
		confirmImageCandidate,
	};
};
