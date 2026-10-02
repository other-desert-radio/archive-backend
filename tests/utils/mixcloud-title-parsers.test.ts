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

const examples = [
	[
		"trailing-apostrophe-dj-name-with-month-and-year",
		"Andrew Storrs' From the Vault 5, February 2020",
		"Andrew Storrs",
		"From the Vault 5",
		"February 2020",
	],
	[
		"possessive-dj-name-with-date",
		"Ethan Primason's Yugoslav Special - August 10, 2020",
		"Ethan Primason",
		"Yugoslav Special",
		"August 10, 2020",
	],
	[
		"k-sera-sarah-possessive-dj-name-with-date",
		"K Serah Sarah's Beyond Karaoke, August 10,2020",
		"K Serah Sarah",
		"Beyond Karaoke",
		"August 10,2020",
	],
	[
		"trailing-apostrophe-dj-name-with-date",
		"Derek Monypeny' - Freedom Overspill, September 7, 2026",
		"Derek Monypeny",
		"Freedom Overspill",
		"September 7, 2026",
	],
	[
		"common-comma-date-with-flexible-spacing",
		"Derek Monypeny-Freedom Overspill, Sept 13,2021",
		"Derek Monypeny",
		"Freedom Overspill",
		"Sept 13,2021",
	],
	[
		"colon-date",
		"Justin Paszul: Stand-Up Cosmogony, March 3, 2025",
		"Justin Paszul",
		"Stand-Up Cosmogony",
		"March 3, 2025",
	],
	[
		"common-comma-date",
		"Ethan - Side A, April 6, 2020",
		"Ethan",
		"Side A",
		"April 6, 2020",
	],
	[
		"hyphen-date",
		"Caroline - Mojave Window Optics pt. 2 - June 1, 2020",
		"Caroline",
		"Mojave Window Optics pt. 2",
		"June 1, 2020",
	],
	[
		"broadcast-date",
		"Ethan and Caroline - 24 Hour Drone, Broadcast on April 25, 2020",
		"Ethan and Caroline",
		"24 Hour Drone",
		"April 25, 2020",
	],
	[
		"trailing-apostrophe-dj-name-without-date",
		"Andrew Storrs' From the Vault 4 - Sounds from 6th and Market, 2012",
		"Andrew Storrs",
		"From the Vault 4 - Sounds from 6th and Market, 2012",
	],
	[
		"hyphen-without-date-with-apostrophe-in-title",
		"NATIONWIDEONYRSIDE - Live at Lander's Brew - Side B 2019",
		"NATIONWIDEONYRSIDE",
		"Live at Lander's Brew - Side B 2019",
	],
	[
		"possessive-dj-name-without-date",
		"Someone's Show - Special",
		"Someone",
		"Show - Special",
	],
	[
		"colon-without-date",
		"Peacetime Product: Episode 1 - Old Beginnings + New Endings",
		"Peacetime Product",
		"Episode 1 - Old Beginnings + New Endings",
	],
	["hyphen-without-date", "Florina - ASEDR 6", "Florina", "ASEDR 6"],
	[
		"known-dj-name",
		"Pequeña Cretina Volume IV, November 27, 2023",
		"Pequeña Cretina",
		"Volume IV",
		"November 27, 2023",
	],
	[
		"known-dj-name",
		"Mellow and Normal Ep. 3, August 8, 2022",
		"Mellow and Normal",
		"Ep. 3",
		"August 8, 2022",
	],
	[
		"known-dj-name",
		"Temporal Emissions Episode 7: December 22, 2025",
		"Temporal Emissions",
		"Episode 7",
		"December 22, 2025",
	],
	[
		"known-dj-name",
		"Dev.01d Episode 1, April 6, 2020",
		"Dev.01d",
		"Episode 1",
		"April 6, 2020",
	],
] as const;

for (const [key, name, djName, title, date] of examples) {
	test(`${key} captures ${name}`, () => {
		const parser = parsers.find((entry) => entry.key === key);
		if (!parser) throw new Error(`Missing ${key} parser`);
		expect(parser.parse(name)).toEqual({
			djName,
			title,
			...(date === undefined ? {} : { date }),
		});
	});
}

test("known-DJ matching treats punctuation literally", () => {
	const parser = parsers.find((entry) => entry.key === "known-dj-name");
	if (!parser) throw new Error("Missing known-DJ parser");
	expect(parser.parse("DevX01d Episode 1, April 6, 2020")).toBeUndefined();
});
