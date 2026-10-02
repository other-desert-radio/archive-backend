import { expect, test } from "bun:test";
import { parsers } from "../../src/utils/mixcloud-parser/index.js";

test("common comma-date matcher captures DJ, title, and raw date", () => {
	const parser = parsers.find((entry) => entry.key === "common-comma-date");
	if (!parser) throw new Error("Missing common comma-date parser");
	expect(parser.parse("Ethan - Side A, April 6, 2020")).toEqual({
		djName: "Ethan",
		title: "Side A",
		date: "April 6, 2020",
	});
	expect(
		parser.parse("Caroline - Desert, Window - Side B, April 16, 2020"),
	).toEqual({
		djName: "Caroline",
		title: "Desert, Window - Side B",
		date: "April 16, 2020",
	});
	for (const title of [
		"Unstructured show",
		"Ethan - Side A",
		"Ethan - Side A - April 6, 2020",
		"Ethan - Side A, April 6, 2020 trailing text",
	]) {
		expect(parser.parse(title)).toBeUndefined();
	}
});
