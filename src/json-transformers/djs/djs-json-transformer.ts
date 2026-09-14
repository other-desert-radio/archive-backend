import type { DJsJson, DJsSqlData } from "./types.js";

const groupRelationshipIds = <
	K extends "show_id" | "tag_id",
	T extends { dj_id: number } & Record<K, number>,
>(
	rows: T[],
	key: K,
): Map<number, number[]> => {
	const grouped = new Map<number, number[]>();

	for (const row of rows) {
		const ids = grouped.get(row.dj_id) ?? [];
		ids.push(row[key]);
		grouped.set(row.dj_id, ids);
	}

	return grouped;
};

const mergeRelationshipIds = (
	first: Map<number, number[]>,
	second: Map<number, number[]>,
): Map<number, number[]> => {
	const merged = new Map<number, number[]>();

	for (const [djId, ids] of first) {
		merged.set(djId, [...ids]);
	}

	for (const [djId, ids] of second) {
		const existing = merged.get(djId) ?? [];
		merged.set(djId, [...new Set([...existing, ...ids])].sort((a, b) => a - b));
	}

	return merged;
};

export const transformDJs = ({
	djs,
	showDJs,
	djTags,
	showTags,
}: DJsSqlData): DJsJson[] => {
	const showsByDj = groupRelationshipIds(showDJs, "show_id");
	const tagsByDj = mergeRelationshipIds(
		groupRelationshipIds(djTags, "tag_id"),
		groupRelationshipIds(showTags, "tag_id"),
	);

	return djs.map((dj) => ({
		id: dj.id,
		title: dj.title,
		bio: dj.bio,
		...(dj.image === null ? {} : { image: dj.image }),
		shows: showsByDj.get(dj.id) ?? [],
		tags: tagsByDj.get(dj.id) ?? [],
	}));
};
