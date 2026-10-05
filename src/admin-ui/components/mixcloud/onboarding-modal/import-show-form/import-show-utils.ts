import type { MixcloudImportAdminRow } from "../../../../loaders/mixcloud-imports.js";
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
export const resolveImportTagTitles = (
	validTitles: string[],
	invalidKeys: string[],
	options: { title: string }[],
	sourceTags: { key: string; name: string }[] = [],
) => {
	const namesByKey = new Map(sourceTags.map(({ key, name }) => [key, name]));
	const newTitles = invalidKeys.map((key) => {
		const name = namesByKey.get(key);
		if (!name?.trim())
			throw new Error(
				"Source tag names are missing. Refresh Mixcloud before importing this Show.",
			);
		const match = options.find(
			(option) => option.title.toLocaleLowerCase() === name.toLocaleLowerCase(),
		);
		return match?.title ?? name;
	});
	const seen = new Set<string>();
	return [...validTitles, ...newTitles].filter((title) => {
		const comparison = title.toLocaleLowerCase();
		if (seen.has(comparison)) return false;
		seen.add(comparison);
		return true;
	});
};
