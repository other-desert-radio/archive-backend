import { expect, test } from "bun:test";
import { validateShowMP3 } from "../../src/admin-ui/components/shows/onboarding-modal/show-form-modal/validate-show-mp3.js";

test("accepts MP3 filenames case-insensitively without requiring browser MIME", () => {
	const file = new File(["audio"], "SHOW.MP3");
	expect(validateShowMP3(file)).toEqual({ valid: true, file });
});

test("rejects wrong extension, empty files, and files over the size limit", () => {
	for (const file of [
		new File(["audio"], "show.wav"),
		new File([], "show.mp3"),
	])
		expect(validateShowMP3(file).valid).toBe(false);
	const file = new File(["audio"], "show.mp3");
	Object.defineProperty(file, "size", {
		value: 4_000_000_001,
		configurable: true,
	});
	expect(validateShowMP3(file).valid).toBe(false);
	Object.defineProperty(file, "size", { value: 4_000_000_000 });
	expect(validateShowMP3(file).valid).toBe(true);
});
