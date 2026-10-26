import { describe, expect, test } from "bun:test";
import {
	rotatedImageDimensions,
	rotateImage,
} from "../../src/admin-ui/components/shared/modal/image/index.js";

describe("DJ image rotation", () => {
	test("cycles right through the supported quarter turns", () => {
		expect(rotateImage(0, 90)).toBe(90);
		expect(rotateImage(90, 90)).toBe(180);
		expect(rotateImage(180, 90)).toBe(270);
		expect(rotateImage(270, 90)).toBe(0);
	});

	test("cycles left through the supported quarter turns", () => {
		expect(rotateImage(0, -90)).toBe(270);
		expect(rotateImage(270, -90)).toBe(180);
	});

	test("swaps source dimensions only for portrait rotations", () => {
		expect(rotatedImageDimensions(954, 750, 0)).toEqual({
			width: 954,
			height: 750,
		});
		expect(rotatedImageDimensions(954, 750, 90)).toEqual({
			width: 750,
			height: 954,
		});
		expect(rotatedImageDimensions(954, 750, 180)).toEqual({
			width: 954,
			height: 750,
		});
		expect(rotatedImageDimensions(954, 750, 270)).toEqual({
			width: 750,
			height: 954,
		});
	});
});
