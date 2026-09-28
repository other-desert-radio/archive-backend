import { describe, expect, test } from "bun:test";
import { validateDJImageUpload } from "../../src/admin/routes/djs/index.js";

const imageBytes = Buffer.from("image bytes");

describe("validateDJImageUpload", () => {
	test("accepts WebP MIME types", () => {
		expect(
			validateDJImageUpload({
				bytes: imageBytes,
				filename: "dj.webp",
				contentType: "image/webp",
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
			error: "Image must have a WebP MIME type",
		});
	});

	test("rejects non-WebP image MIME types", () => {
		expect(
			validateDJImageUpload({
				bytes: imageBytes,
				filename: "dj.png",
				contentType: "image/png",
			}),
		).toEqual({
			valid: false,
			error: "Image must have a WebP MIME type",
		});
	});

	test("rejects files larger than 1.5 MiB", () => {
		const oversized = Buffer.alloc(1.5 * 1024 * 1024 + 1, 0);
		expect(
			validateDJImageUpload({
				bytes: oversized,
				contentType: "image/webp",
			}),
		).toEqual({
			valid: false,
			error: "Image must be 1.5 MiB or smaller",
		});
	});
});
