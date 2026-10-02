import { expect, test } from "bun:test";
import { isDatabaseId } from "../../src/utils/index.js";

test("database IDs must be positive whole PostgreSQL integers", () => {
	for (const id of [1, 2_147_483_647]) expect(isDatabaseId(id)).toBe(true);
	for (const id of [
		0,
		-1,
		1.5,
		2_147_483_648,
		Number.MAX_SAFE_INTEGER,
		Number.NaN,
		Number.POSITIVE_INFINITY,
	]) {
		expect(isDatabaseId(id)).toBe(false);
	}
});
