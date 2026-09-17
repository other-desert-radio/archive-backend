import { describe, expect, test } from "bun:test";
import { plainTextToSafeHtml } from "../../src/utils/plain-text-to-safe-html.js";

describe("plainTextToSafeHtml", () => {
	test("preserves paragraphs, line breaks, and indentation", () => {
		expect(
			plainTextToSafeHtml("First line\n  indented line\n\tTabbed line"),
		).toBe("<p>First line<br />  indented line<br />    Tabbed line</p>");
	});

	test("escapes unsafe HTML before sanitizing", () => {
		expect(plainTextToSafeHtml("<script>alert('bad')</script>")).toBe(
			`<p>&lt;script&gt;alert('bad')&lt;/script&gt;</p>`,
		);
	});

	test("handles Windows line endings", () => {
		expect(plainTextToSafeHtml("one\r\ntwo")).toBe("<p>one<br />two</p>");
	});
});
