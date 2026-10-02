import type { ParserFnResult, ShowTitleParser } from "./types.js";

const parseWithPattern = ({
	pattern,
	key,
}: {
	pattern: RegExp;
	key: string;
}): ShowTitleParser => ({
	key,
	parse: (value) => {
		const match = pattern.exec(value);
		return match?.groups as ParserFnResult | undefined;
	},
});

export const parsers: Array<ShowTitleParser> = [
	// "Ethan - Side A, April 6, 2020"
	parseWithPattern({
		pattern:
			/^(?<djName>.+?) - (?<title>.+), (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
		key: "common-comma-date",
	}),
];
