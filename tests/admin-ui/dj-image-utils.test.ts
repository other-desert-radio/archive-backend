import { describe, expect, test } from "bun:test";
import {
	croppedDJImageFilename,
	DJ_CROPPED_IMAGE_SIZE,
	validateDJImageFile,
} from "../../src/admin-ui/components/dj/dj-image-utils.js";

describe("validateDJImageFile", () => {
	test("accepts JPEG, PNG, and WebP source files", () => {
		const files = [
			new File(["image bytes"], "portrait.jpg", { type: "image/jpeg" }),
			new File(["image bytes"], "portrait.png", { type: "image/png" }),
			new File(["image bytes"], "portrait.webp", { type: "image/webp" }),
		];

		for (const file of files)
			expect(validateDJImageFile(file)).toEqual({ valid: true, file });
	});

	test("rejects unsupported source files", () => {
		const file = new File(["image bytes"], "portrait.gif", {
			type: "image/gif",
		});

		expect(validateDJImageFile(file)).toEqual({
			valid: false,
			error: "Image must be a JPEG, PNG, or WebP file",
		});
	});

	test("accepts large source files for browser-side cropping", () => {
		const file = new File(
			[new Uint8Array(1.5 * 1024 * 1024 + 1)],
			"portrait.webp",
			{ type: "image/webp" },
		);

		expect(validateDJImageFile(file)).toEqual({ valid: true, file });
	});

	test("creates a WebP filename for cropped images", () => {
		expect(croppedDJImageFilename("portrait.PNG")).toBe("portrait.webp");
		expect(croppedDJImageFilename("no-extension")).toBe("no-extension.webp");
	});

	test("uses a 1200 pixel square crop output", () => {
		expect(DJ_CROPPED_IMAGE_SIZE).toBe(1200);
	});
});
