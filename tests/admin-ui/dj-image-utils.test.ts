import { describe, expect, test } from "bun:test";
import {
	CROPPED_IMAGE_SIZE,
	croppedImageFilename,
	validateImageFile,
} from "../../src/admin-ui/components/shared/modal/image/index.js";

describe("validateImageFile", () => {
	test("accepts JPEG, PNG, and WebP source files", () => {
		const files = [
			new File(["image bytes"], "portrait.jpg", { type: "image/jpeg" }),
			new File(["image bytes"], "portrait.png", { type: "image/png" }),
			new File(["image bytes"], "portrait.webp", { type: "image/webp" }),
		];

		for (const file of files)
			expect(validateImageFile(file)).toEqual({ valid: true, file });
	});

	test("rejects unsupported source files", () => {
		const file = new File(["image bytes"], "portrait.gif", {
			type: "image/gif",
		});

		expect(validateImageFile(file)).toEqual({
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

		expect(validateImageFile(file)).toEqual({ valid: true, file });
	});

	test("creates a WebP filename for cropped images", () => {
		expect(croppedImageFilename("portrait.PNG")).toBe("portrait.webp");
		expect(croppedImageFilename("no-extension")).toBe("no-extension.webp");
	});

	test("uses a 1200 pixel square crop output", () => {
		expect(CROPPED_IMAGE_SIZE).toBe(1200);
	});
});
