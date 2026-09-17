/**
 * Checks whether an optional string is absent or contains no characters.
 *
 * @param value - The optional string to inspect.
 * @returns `true` when the value is `undefined` or an empty string.
 */
export const undefinedOrEmpty = (value: string | undefined): boolean =>
	value === undefined || value === "";
