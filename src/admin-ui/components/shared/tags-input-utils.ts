import { splitCommaSeparated } from "../../../utils/index.js";

export type TagsInputOption = {
	id: number;
	title: string;
	color: string;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase();

/** Returns a case-insensitive, de-duplicated tag list while preserving spelling. */
export const uniqueTagTitles = (values: string[]): string[] => {
	const seen = new Set<string>();
	return values.flatMap((value) => {
		const trimmed = value.trim();
		const key = normalize(trimmed);
		if (key === "" || seen.has(key)) return [];
		seen.add(key);
		return [trimmed];
	});
};

/** Commits comma-delimited values into a tag list without adding duplicates. */
export const commitTagDraft = (tags: string[], draft: string): string[] =>
	uniqueTagTitles([...tags, ...splitCommaSeparated(draft)]);

/** Finds available tags, keeping prefix matches ahead of other substring matches. */
export const findTagMatches = (
	draft: string,
	tags: TagsInputOption[],
	selected: string[],
): TagsInputOption[] => {
	const query = normalize(draft);
	if (query === "") return [];
	const selectedKeys = new Set(selected.map(normalize));
	return tags
		.filter(
			(tag) =>
				!selectedKeys.has(normalize(tag.title)) &&
				normalize(tag.title).includes(query),
		)
		.sort((first, second) => {
			const firstPrefix = normalize(first.title).startsWith(query);
			const secondPrefix = normalize(second.title).startsWith(query);
			if (firstPrefix !== secondPrefix) return firstPrefix ? -1 : 1;
			return first.title.localeCompare(second.title, undefined, {
				sensitivity: "base",
			});
		});
};

/** Returns the untyped suffix only when a match is a true prefix completion. */
export const getTagCompletion = (
	draft: string,
	match: TagsInputOption | undefined,
): string | undefined => {
	if (match === undefined || draft === "") return undefined;
	if (!normalize(match.title).startsWith(normalize(draft))) return undefined;
	return match.title.slice(draft.length);
};
