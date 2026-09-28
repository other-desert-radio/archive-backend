import { describe, expect, test } from "bun:test";
import { validateDJImageUpload } from "../../src/admin/routes/djs/index.js";

const imageBytes = Buffer.from("image bytes");

describe("validateDJImageUpload", () => {
	test("accepts JPEG, PNG, and WebP MIME types", () => {
		for (const contentType of ["image/jpeg", "image/png", "image/webp"])
			expect(
				validateDJImageUpload({
					bytes: imageBytes,
					contentType,
				}),
			).toEqual({ valid: true, image: { bytes: imageBytes } });
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

	test("rejects unsupported image MIME types", () => {
		expect(
			validateDJImageUpload({
				bytes: imageBytes,
				filename: "dj.gif",
				contentType: "image/gif",
			}),
		).toEqual({
			valid: false,
			error: "Image must have a JPEG, PNG, or WebP MIME type",
		});
	});

	test("accepts large source files for Sharp processing", () => {
		const oversized = Buffer.alloc(1.5 * 1024 * 1024 + 1, 0);
		expect(
			validateDJImageUpload({
				bytes: oversized,
				contentType: "image/webp",
			}),
		).toEqual({ valid: true, image: { bytes: oversized } });
	});
});
