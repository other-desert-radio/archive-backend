import { expect, test } from "bun:test";
import { isHttpUrl } from "../../src/utils/index.js";

test("accepts absolute HTTP(S) URLs using the URL parser", () => {
	for (const value of [
		"http://example.test",
		"https://example.test/path?q=1#hash",
		"HTTPS://example.test",
		" https://example.test ",
	])
		expect(isHttpUrl(value)).toBe(true);
});
test("rejects malformed, relative and non-HTTP(S) URLs without throwing", () => {
	for (const value of [
		"",
		" ",
		"/path",
		"example.test",
		"//example.test",
		"https://",
		"ftp://example.test",
		"javascript:alert(1)",
		"mailto:a@example.test",
		"data:text/plain,hello",
	])
		expect(isHttpUrl(value)).toBe(false);
});
