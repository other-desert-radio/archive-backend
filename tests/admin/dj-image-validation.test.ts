import { describe, expect, test } from "bun:test";
import { validateDJImageUpload } from "../../src/admin/routes/djs/index.js";

const imageBytes = Buffer.from("image bytes");

describe("validateDJImageUpload", () => {
	test("accepts supported MIME types and normalizes filenames", () => {
		expect(
			validateDJImageUpload({
				bytes: imageBytes,
				filename: "../DJ portrait.JPEG",
				contentType: "image/jpeg",
			}),
		).toEqual({
			valid: true,
			image: {
				bytes: imageBytes,
				filename: "DJ-portrait.jpg",
				contentType: "image/jpeg",
			},
		});
		expect(
			validateDJImageUpload({
				bytes: imageBytes,
				filename: "dj.png",
				contentType: "image/png",
			}),
		).toMatchObject({
			valid: true,
			image: { filename: "dj.png", contentType: "image/png" },
		});
		expect(
			validateDJImageUpload({
				bytes: imageBytes,
				filename: "dj.webp",
				contentType: "image/webp",
			}),
		).toMatchObject({
			valid: true,
			image: { filename: "dj.webp", contentType: "image/webp" },
		});
	});

	test("rejects unsupported MIME types", () => {
		expect(
			validateDJImageUpload({
				bytes: imageBytes,
				filename: "dj.jpg",
				contentType: "application/octet-stream",
			}),
		).toEqual({
			valid: false,
			error: "Image must have a JPEG, PNG, or WebP MIME type",
		});
	});

	test("rejects mismatched filename extensions", () => {
		expect(
			validateDJImageUpload({
				bytes: imageBytes,
				filename: "dj.png",
				contentType: "image/jpeg",
			}),
		).toEqual({
			valid: false,
			error: "Image filename extension does not match its MIME type",
		});
	});

	test("rejects files larger than 10 MiB", () => {
		const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
		expect(
			validateDJImageUpload({
				bytes: oversized,
				contentType: "image/png",
			}),
		).toEqual({
			valid: false,
			error: "Image must be 10 MiB or smaller",
		});
	});

	test("provides a safe default filename", () => {
		expect(
			validateDJImageUpload({
				bytes: imageBytes,
				contentType: "image/png",
			}),
		).toMatchObject({
			valid: true,
			image: { filename: "image.png" },
		});
	});
});
