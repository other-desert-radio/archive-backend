import { useCallback, useEffect, useState } from "react";
import type { PublicationPreview } from "../../../publication/index.js";
import { preparePublicationPreview } from "../../loaders/publication.js";

export const usePublicationPreview = (
	enabled: boolean,
	retryJobId?: string,
) => {
	const [preview, setPreview] = useState<PublicationPreview>();
	const [error, setError] = useState<string>();
	const [version, setVersion] = useState(0);
	const refresh = useCallback(() => setVersion((value) => value + 1), []);
	const invalidate = useCallback(() => {
		setPreview(undefined);
		setError("Refresh the preview before publishing again.");
	}, []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: version explicitly requests a fresh summary
	useEffect(() => {
		let obsolete = false;
		setPreview(undefined);
		setError(undefined);
		if (!enabled) return;
		void preparePublicationPreview(retryJobId).then(
			(next) => {
				if (!obsolete) setPreview(next);
			},
			(failure) => {
				if (!obsolete)
					setError(
						failure instanceof Error
							? failure.message
							: "Could not prepare changes. Refresh the preview to try again.",
					);
			},
		);
		return () => {
			obsolete = true;
		};
	}, [enabled, retryJobId, version]);
	return { preview, error, refresh, invalidate };
};
