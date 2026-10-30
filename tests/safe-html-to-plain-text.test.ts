import { expect, test } from "bun:test";
import { safeHtmlToPlainText } from "../src/utils/index.js";
import { plainTextToSafeHtml } from "../src/utils/plain-text-to-safe-html.js";

test("safe HTML round trips literal markup, entities and multiline descriptions", () => {
	const text = 'First & second\n<script>alert("x")</script> &lt; &#60;';
	const html = plainTextToSafeHtml(text);
	expect(html).not.toContain("<script>");
	expect(safeHtmlToPlainText(html)).toBe(text);
	expect(
		safeHtmlToPlainText("<p>First</p><ul><li>Second &amp; third</li></ul>"),
	).toBe("First\nSecond & third");
	expect(safeHtmlToPlainText("&#x1F600; &#39; &nbsp; &#99999999;")).toBe(
		"😀 ' \u00a0 &#99999999;",
	);
});
