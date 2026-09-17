import { describe, expect, test } from "bun:test";
import { dummyDJs } from "../../src/db/dummy-djs.js";

describe("dummy DJ seed data", () => {
	test("contains standalone DJs with the required fields", () => {
		expect(dummyDJs).toHaveLength(5);
		expect(
			dummyDJs.every((dj) => dj.title.length > 0 && dj.bio.length > 0),
		).toBe(true);
		expect(
			dummyDJs.every((dj) => dj.image === null && dj.socials === null),
		).toBe(true);
	});

	test("uses distinct titles", () => {
		expect(new Set(dummyDJs.map((dj) => dj.title)).size).toBe(dummyDJs.length);
	});
});
