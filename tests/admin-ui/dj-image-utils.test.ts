import { describe, expect, test } from "bun:test";
import {
	croppedDJImageFilename,
	DJ_CROPPED_IMAGE_SIZE,
	validateDJImageFile,
} from "../../src/admin-ui/components/dj/dj-image-utils.js";

describe("validateDJImageFile", () => {
	test("accepts WebP files", () => {
		const file = new File(["image bytes"], "portrait.webp", {
			type: "image/webp",
		});

		expect(validateDJImageFile(file)).toEqual({ valid: true, file });
	});

	test("rejects non-WebP files", () => {
		const file = new File(["image bytes"], "portrait.png", {
			type: "image/png",
		});

		expect(validateDJImageFile(file)).toEqual({
			valid: false,
			error: "Image must be a WebP file",
		});
	});

	test("rejects files larger than 1.5 MiB", () => {
		const file = new File(
			[new Uint8Array(1.5 * 1024 * 1024 + 1)],
			"portrait.webp",
			{ type: "image/webp" },
		);

		expect(validateDJImageFile(file)).toEqual({
			valid: false,
			error: "Image must be 1.5 MiB or smaller",
		});
	});

	test("creates a WebP filename for cropped images", () => {
		expect(croppedDJImageFilename("portrait.webp")).toBe("portrait.webp");
		expect(croppedDJImageFilename("no-extension")).toBe("no-extension.webp");
	});

	test("uses a 1200 pixel square crop output", () => {
		expect(DJ_CROPPED_IMAGE_SIZE).toBe(1200);
	});
});
