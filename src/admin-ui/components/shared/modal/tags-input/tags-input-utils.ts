import { splitCommaSeparated } from "../../../../../utils/index.js";
import {
	findAutocompleteMatches,
	getAutocompleteCompletion,
} from "../autocomplete/index.js";

export type SelectedTag = {
	title: string;
	mixcloud_key?: string;
	mixcloud_url?: string;
};

export type TagsInputOption = SelectedTag & {
	id: number;
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
	return findAutocompleteMatches(
		draft,
		tags.filter((tag) => !selectedKeys.has(normalize(tag.title))),
		(tag) => tag.title,
	);
};

/** Returns the untyped suffix only when a match is a true prefix completion. */
export const getTagCompletion = (
	draft: string,
	match: TagsInputOption | undefined,
): string | undefined => {
	return getAutocompleteCompletion(draft, match?.title);
};

/** Preserve metadata on the first selected tag when deduplicating titles. */
export const uniqueSelectedTags = (tags: SelectedTag[]): SelectedTag[] => {
	const seen = new Set<string>();
	return tags.flatMap((tag) => {
		const title = tag.title.trim();
		const key = normalize(title);
		if (!key || seen.has(key)) return [];
		seen.add(key);
		return [{ ...tag, title }];
	});
};

export const commitSelectedTagDraft = (
	tags: SelectedTag[],
	draft: string,
): SelectedTag[] =>
	uniqueSelectedTags([
		...tags,
		...splitCommaSeparated(draft).map((title) => ({ title })),
	]);
