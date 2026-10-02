import { expect, test } from "bun:test";
import { classifyMixcloudImport } from "../../src/utils/index.js";

const ready = {
	show_id: null,
	derived_title: "Show",
	derived_date: new Date("2020-04-06T00:00:00Z"),
	decoded_djs: ["Ethan"],
	parser_version: 1,
	parser_key: "common-comma-date",
	date_source: "title" as const,
};
test("classifies complete pending suggestions, including JSON dates", () => {
	expect(classifyMixcloudImport(ready)).toBe("auto_parsed");
	expect(
		classifyMixcloudImport({ ...ready, derived_date: "2020-04-06T00:00:00Z" }),
	).toBe("auto_parsed");
	expect(classifyMixcloudImport({ ...ready, show_id: 1 })).toBeUndefined();
});
for (const incomplete of [
	{},
	{ ...ready, derived_title: "  " },
	{ ...ready, derived_date: null },
	{ ...ready, derived_date: "invalid" },
	{ ...ready, decoded_djs: [] },
	{ ...ready, decoded_djs: ["Ethan", " "] },
	{ ...ready, parser_key: null },
	{ ...ready, parser_version: null },
	{ ...ready, date_source: "created_time" as const },
]) {
	test(`requires review for ${JSON.stringify(incomplete)}`, () => {
		expect(classifyMixcloudImport(incomplete)).toBe("unparsable");
	});
}
