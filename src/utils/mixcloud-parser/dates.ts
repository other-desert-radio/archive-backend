/** ISO source timestamps require seconds and an explicit timezone. */
export const createdTimeRegex =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

const months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/** Construct a UTC calendar day without allowing JavaScript's date rollover. */
const calendarDate = (
	year: number,
	month: number,
	day: number,
): Date | undefined => {
	if (year < 1 || year > 9999) return undefined;
	const date = new Date(0);
	date.setUTCFullYear(year, month, day);
	return date.getUTCFullYear() === year &&
		date.getUTCMonth() === month &&
		date.getUTCDate() === day
		? date
		: undefined;
};

/** English title dates; month/year captures use the first day of the month. */
export const parseTitleDate = (value: string | undefined): Date | undefined => {
	// Matches "April 6, 2020", "Sept 13,2021", and "February 2020".
	// Captures: month name, optional day followed by a comma, four-digit year.
	// Month lookup and calendar validation below reject unknown or impossible dates.
	const match = value
		?.trim()
		.match(/^([A-Z][a-z]+) (?:(\d{1,2}),\s*)?(\d{4})$/);
	if (!match) return undefined;
	const month = match[1] === "Sept" ? 8 : months.indexOf(match[1] ?? "");
	if (month < 0) return undefined;
	return calendarDate(Number(match[3]), month, Number(match[2] ?? 1));
};

/** Validate the source timestamp and retain its UTC calendar day at midnight. */
export const parseCreatedTimeDate = (value: string): Date | undefined => {
	// Matches "2020-04-07T12:00:00Z", "2020-04-07T01:30:00.123+02:00",
	// and "2020-04-07T23:30:00-02:00"; a timezone is required.
	// Captures: year, month, day, hour, minute, second, timezone, offset hour/minute.
	// Fractional seconds are optional and not captured; ranges are validated below.
	const match = value.match(createdTimeRegex);
	if (
		!match ||
		!calendarDate(Number(match[1]), Number(match[2]) - 1, Number(match[3])) ||
		Number(match[4]) > 23 ||
		Number(match[5]) > 59 ||
		Number(match[6]) > 59 ||
		Number(match[8] ?? 0) > 23 ||
		Number(match[9] ?? 0) > 59
	)
		return undefined;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return undefined;
	return calendarDate(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate(),
	);
};
