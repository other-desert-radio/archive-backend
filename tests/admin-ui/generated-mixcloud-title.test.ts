import { expect, test } from "bun:test";
import { generatedMixcloudTitle } from "../../src/admin-ui/components/shows/onboarding-modal/show-form-modal/generated-mixcloud-title.js";

test("formats show dates and selected DJ order", () => {
	expect(
		generatedMixcloudTitle(
			["Justin Paszul"],
			" Constant Coverage #2 ",
			"2026-10-19",
		),
	).toBe("Justin Paszul - Constant Coverage #2, October 19, 2026");
	expect(generatedMixcloudTitle(["B", "A"], "Show", "2026-01-01")).toBe(
		"B + A - Show, January 1, 2026",
	);
});
test("uses available fields without dangling separators", () => {
	for (const [names, title, date, expected] of [
		[[], "", "", ""],
		[[], "Show", "", "Show"],
		[["DJ"], "", "", "DJ"],
		[["DJ"], "Show", "", "DJ - Show"],
		[[], "", "2026-01-01", "January 1, 2026"],
		[[], "Show", "2026-01-01", "Show, January 1, 2026"],
		[["DJ"], " ", "2026-01-01", "DJ, January 1, 2026"],
		[["DJ"], "Show", "2026-02-30", "DJ - Show"],
	] as const)
		expect(generatedMixcloudTitle([...names], title, date)).toBe(expected);
});
