import type { ResolveMixcloudTagsResponse } from "./types.js";

type ArchiveTagWithMixcloudKey = {
	id: number;
	title: string;
	color: string;
	mixcloud_key: string | null;
};

/** Resolves distinct source keys to archive tags, rejecting missing or ambiguous matches. */
export const resolveMixcloudTags = (
	incomingMixcloudKeys: string[],
	archiveTags: ArchiveTagWithMixcloudKey[],
): ResolveMixcloudTagsResponse => {
	const resolution: ResolveMixcloudTagsResponse = { valid: [], invalid: [] };
	const archiveTagsByMixcloudKey = new Map<
		string,
		ArchiveTagWithMixcloudKey[]
	>();

	for (const tag of archiveTags) {
		if (tag.mixcloud_key === null) {
			continue;
		}
		const tagsForKey = archiveTagsByMixcloudKey.get(tag.mixcloud_key) ?? [];
		tagsForKey.push(tag);
		archiveTagsByMixcloudKey.set(tag.mixcloud_key, tagsForKey);
	}

	for (const mixcloudKey of new Set(incomingMixcloudKeys)) {
		const matchingTags = archiveTagsByMixcloudKey.get(mixcloudKey) ?? [];
		const matchedTag = matchingTags[0];

		if (matchingTags.length !== 1 || matchedTag === undefined) {
			resolution.invalid.push(mixcloudKey);
			continue;
		}

		resolution.valid.push({
			key: mixcloudKey,
			tag: {
				id: matchedTag.id,
				title: matchedTag.title,
				color: matchedTag.color,
			},
		});
	}

	return resolution;
};
