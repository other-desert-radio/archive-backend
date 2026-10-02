/**
 * Checks whether a numeric ID fits the archive's positive PostgreSQL integer IDs.
 *
 * @param id - Numeric ID to inspect before querying an archive table.
 * @returns True for whole numbers from 1 through PostgreSQL's integer maximum.
 */
export const isDatabaseId = (id: number): boolean =>
	Number.isInteger(id) && id > 0 && id <= 2_147_483_647;
