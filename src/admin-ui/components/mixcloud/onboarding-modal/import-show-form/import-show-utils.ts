import type { MixcloudImportAdminRow } from "../../../../loaders/mixcloud-imports.js";
import {
	type SelectedTag,
	uniqueSelectedTags,
} from "../../../shared/modal/index.js";
import type { ShowFormValues } from "../../../shows/index.js";

/** Source metadata initializes the complete Show payload without adding image inputs. */
export const initialImportValues = (
	row: MixcloudImportAdminRow,
): ShowFormValues => ({
	title: row.derived_title ?? row.name ?? "",
	date:
		row.derived_date === undefined
			? ""
			: new Date(row.derived_date).toISOString().slice(0, 10),
	duration: row.duration === undefined ? "" : String(row.duration),
	url: row.url ?? "",
	image_small: row.image_small ?? "",
	image_large: row.image_large ?? "",
	selected: [],
	tags: [],
	tagDraft: "",
});

/** Only a unique, trimmed, case-insensitive exact DJ title match is selected. */
export const resolveImportDJs = (
	names: string[],
	djs: { id: number; title: string }[],
) => {
	const selected = new Set<number>();
	const unmatched = new Set<string>();
	for (const rawName of names) {
		const name = rawName.trim();
		if (name === "") continue;
		const matches = djs.filter(
			(dj) => dj.title.trim().toLowerCase() === name.toLowerCase(),
		);
		if (matches.length === 1 && matches[0]) selected.add(matches[0].id);
		else unmatched.add(name);
	}
	return { selected: [...selected], unmatched: [...unmatched] };
};

/** Database names take precedence; new titles preserve the source name exactly. */
export const resolveImportTags = (
	validTitles: string[],
	invalidKeys: string[],
	options: { title: string }[],
	sourceTags: { key: string; name: string; url?: string }[] = [],
) => {
	const tagsByKey = new Map(sourceTags.map((tag) => [tag.key, tag]));
	const newTitles = invalidKeys.map((key) => {
		const source = tagsByKey.get(key);
		const name = source?.name;
		if (!name?.trim())
			throw new Error(
				"Source tag names are missing. Refresh Mixcloud before importing this Show.",
			);
		const match = options.find(
			(option) => option.title.toLocaleLowerCase() === name.toLocaleLowerCase(),
		);
		return match
			? { title: match.title }
			: {
					title: name,
					mixcloud_key: key,
					...(source?.url === undefined ? {} : { mixcloud_url: source.url }),
				};
	});
	return uniqueSelectedTags([
		...validTitles.map((title) => ({ title })),
		...newTitles,
	]);
};

/** Only selected source tags absent from the archive need explicit onboarding. */
export const buildImportTagRequests = (
	tags: SelectedTag[],
	options: { title: string }[],
) =>
	tags.flatMap((tag) => {
		if (
			!tag.mixcloud_key ||
			options.some(
				(option) =>
					option.title.trim().toLocaleLowerCase() ===
					tag.title.trim().toLocaleLowerCase(),
			)
		)
			return [];
		if (!tag.mixcloud_url?.trim())
			throw new Error(
				"Source tag URLs are missing. Refresh Mixcloud before importing this Show.",
			);
		return [
			{
				title: tag.title,
				mixcloud_key: tag.mixcloud_key,
				mixcloud_url: tag.mixcloud_url,
			},
		];
	});
