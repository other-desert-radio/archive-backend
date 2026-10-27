/** Build a preview from available fields, formatting dates independently of timezone. */
export const generatedMixcloudTitle = (
	names: string[],
	title: string,
	date: string,
): string => {
	const heading = [
		names
			.map((name) => name.trim())
			.filter(Boolean)
			.join(" + "),
		title.trim(),
	]
		.filter(Boolean)
		.join(" - ");
	const parsed = new Date(`${date}T00:00:00.000Z`);
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
		!Number.isFinite(parsed.getTime()) ||
		parsed.toISOString().slice(0, 10) !== date
	)
		return heading;
	const formatted = new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(parsed);
	return [heading, formatted].filter(Boolean).join(", ");
};
