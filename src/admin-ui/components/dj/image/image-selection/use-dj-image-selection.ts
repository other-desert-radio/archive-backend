import { useCallback, useEffect, useRef, useState } from "react";
import { decodeDJImageFile } from "../utils/index.js";

/** Owns decoded candidates, accepted crops, removal and cancellation cleanup. */
export const useDJImageSelection = (
	isOpen: boolean,
	record: { id: number } | undefined | null = null,
) => {
	const [image, setImage] = useState<File>();
	const [imageCandidate, setImageCandidate] = useState<File>();
	const [imageError, setImageError] = useState<string>();
	const [isExistingImageRemoved, setIsExistingImageRemoved] = useState(false);
	const [imageDropzoneKey, setImageDropzoneKey] = useState(0);
	const imageCandidateVersion = useRef(0);
	useEffect(() => {
		if (!isOpen || record === undefined) return;
		setImage(undefined);
		setImageCandidate(undefined);
		setImageError(undefined);
		setIsExistingImageRemoved(false);
		setImageDropzoneKey((current) => current + 1);
		return () => {
			imageCandidateVersion.current += 1;
		};
	}, [isOpen, record]);
	const selectImageCandidate = async (candidate: File) => {
		const version = ++imageCandidateVersion.current;
		setImageError(undefined);
		const result = await decodeDJImageFile(candidate);
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
	return {
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
