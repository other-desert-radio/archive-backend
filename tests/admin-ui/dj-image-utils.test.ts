import { describe, expect, test } from "bun:test";
import { validateDJImageFile } from "../../src/admin-ui/components/dj/dj-image-utils.js";

describe("validateDJImageFile", () => {
	test("accepts supported files with matching extensions", () => {
		const file = new File(["image bytes"], "portrait.PNG", {
			type: "image/png",
		});

		expect(validateDJImageFile(file)).toEqual({ valid: true, file });
	});

	test("rejects MIME and extension mismatches", () => {
		const file = new File(["image bytes"], "portrait.png", {
			type: "image/jpeg",
		});

		expect(validateDJImageFile(file)).toEqual({
			valid: false,
			error:
				"Image must be a JPEG, PNG, or WebP file with a matching extension",
		});
	});

	test("rejects files larger than 10 MiB", () => {
		const file = new File(
			[new Uint8Array(10 * 1024 * 1024 + 1)],
			"portrait.png",
			{ type: "image/png" },
		);

		expect(validateDJImageFile(file)).toEqual({
			valid: false,
			error: "Image must be 10 MiB or smaller",
		});
	});
});
