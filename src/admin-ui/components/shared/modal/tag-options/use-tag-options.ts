import { useCallback, useEffect, useRef, useState } from "react";
import { loadTags } from "../../../../loaders/tags.js";
import type { TagsInputOption } from "../tags-input/index.js";

/** Loads tag choices while a form is open and ignores obsolete requests. */
export const useTagOptions = (isOpen: boolean) => {
	const [tagOptions, setTagOptions] = useState<TagsInputOption[]>([]);
	const [isTagsLoading, setIsTagsLoading] = useState(false);
	const [tagsError, setTagsError] = useState<string>();
	const tagRequestVersion = useRef(0);
	const loadTagOptions = useCallback(() => {
		const version = ++tagRequestVersion.current;
		setIsTagsLoading(true);
		setTagsError(undefined);
		setTagOptions([]);
		loadTags()
			.then((loadedTags) => {
				if (version !== tagRequestVersion.current) return;
				setTagOptions(
					loadedTags.map(({ id, title, color }) => ({ id, title, color })),
				);
			})
			.catch(() => {
				if (version === tagRequestVersion.current)
					setTagsError("Existing tags could not be loaded.");
			})
			.finally(() => {
				if (version === tagRequestVersion.current) setIsTagsLoading(false);
			});
	}, []);
	useEffect(() => {
		if (!isOpen) return;
		loadTagOptions();
		return () => {
			tagRequestVersion.current += 1;
		};
	}, [isOpen, loadTagOptions]);

	return { tagOptions, isTagsLoading, tagsError, loadTagOptions };
};
