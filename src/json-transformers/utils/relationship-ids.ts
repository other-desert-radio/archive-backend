/**
 * Groups relationship rows by one numeric property while preserving the input
 * order of the related IDs.
 *
 * The database queries currently order these rows, so IDs remain ordered in
 * the API response. This helper intentionally does not deduplicate IDs; tag
 * relationships are normalized by `mergeRelationshipIds` instead.
 *
 * @example
 * ```ts
 * groupRelationshipIds({
 *   rows: [{ dj_id: 1, show_id: 10 }, { dj_id: 1, show_id: 11 }],
 *   groupKey: "dj_id",
 *   idKey: "show_id",
 * }); // Map { 1 => [10, 11] }
 * ```
 */
type GroupRelationshipIdsParams<
	GroupKey extends PropertyKey,
	IdKey extends PropertyKey,
	T extends Record<GroupKey, number> & Record<IdKey, number>,
> = {
	rows: T[];
	groupKey: GroupKey;
	idKey: IdKey;
};

export const groupRelationshipIds = <
	GroupKey extends PropertyKey,
	IdKey extends PropertyKey,
	T extends Record<GroupKey, number> & Record<IdKey, number>,
>({
	rows,
	groupKey,
	idKey,
}: GroupRelationshipIdsParams<GroupKey, IdKey, T>): Map<number, number[]> => {
	const grouped = new Map<number, number[]>();

	for (const row of rows) {
		const groupId = row[groupKey];
		const ids = grouped.get(groupId) ?? [];
		ids.push(row[idKey]);
		grouped.set(groupId, ids);
	}

	return grouped;
};

/**
 * Combines two DJ-to-ID maps, removing duplicate IDs and sorting each result.
 *
 * A DJ can receive a tag directly through `dj_tags` and indirectly through a
 * tagged show in `show_tags`. Both sources are represented in the DJ JSON as
 * one sorted list of tag IDs.
 *
 * @example
 * ```ts
 * mergeRelationshipIds(
 *   new Map([[1, [20, 22]]]),
 *   new Map([[1, [21, 20]]]),
 * ); // Map { 1 => [20, 21, 22] }
 * ```
 */
export const mergeRelationshipIds = (
	first: Map<number, number[]>,
	second: Map<number, number[]>,
): Map<number, number[]> => {
	const merged = new Map<number, number[]>();

	for (const [djId, ids] of first) {
		merged.set(djId, [...ids]);
	}

	for (const [djId, ids] of second) {
		const existing = merged.get(djId) ?? [];
		merged.set(
			djId,
			[...new Set([...existing, ...ids])].sort((a, b) => a - b),
		);
	}

	return merged;
};
