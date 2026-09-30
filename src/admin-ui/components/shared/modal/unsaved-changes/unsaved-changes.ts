type FormValues = Record<
	string,
	string | boolean | File | undefined | string[] | number[]
>;

/** Compares editable values, treating relationship selections as sets. */
export const hasFormChanges = (
	current: FormValues,
	initial: FormValues,
): boolean =>
	Object.keys(current).some((key) => {
		const value = current[key];
		const baseline = initial[key];
		if (Array.isArray(value) && Array.isArray(baseline)) {
			const selected = new Set<string | number>(value);
			const original = new Set<string | number>(baseline);
			return (
				selected.size !== original.size ||
				[...selected].some((item) => !original.has(item))
			);
		}
		return value !== baseline;
	});
