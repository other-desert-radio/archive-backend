import { describe, expect, test } from "bun:test";
import { formatLogLine } from "../../src/utils/pretty-log-stream.js";

describe("formatLogLine", () => {
	test("puts the message before gray structured details", () => {
		const output = formatLogLine(
			'{"level":30,"timestamp":"2026-09-18T12:00:00.000Z","msg":"[DJ Creation] DJ created","djId":5}',
		);

		expect(output).toBe(
			'[DJ Creation] DJ created\n\u001b[90m{\u001b[0m\n\u001b[90m  "level": 30,\u001b[0m\n\u001b[90m  "timestamp": "2026-09-18T12:00:00.000Z",\u001b[0m\n\u001b[90m  "djId": 5\u001b[0m\n\u001b[90m}\u001b[0m\n',
		);
	});

	test("preserves lines that are not JSON logs", () => {
		expect(formatLogLine("not JSON")).toBe("not JSON\n");
	});
});
