import { describe, expect, test } from "bun:test";
import {
	rotateDJImage,
	rotatedDJImageDimensions,
} from "../../src/admin-ui/components/dj/image/crop-modal/dj-image-crop-utils.js";

describe("DJ image rotation", () => {
	test("cycles right through the supported quarter turns", () => {
		expect(rotateDJImage(0, 90)).toBe(90);
		expect(rotateDJImage(90, 90)).toBe(180);
		expect(rotateDJImage(180, 90)).toBe(270);
		expect(rotateDJImage(270, 90)).toBe(0);
	});

	test("cycles left through the supported quarter turns", () => {
		expect(rotateDJImage(0, -90)).toBe(270);
		expect(rotateDJImage(270, -90)).toBe(180);
	});

	test("swaps source dimensions only for portrait rotations", () => {
		expect(rotatedDJImageDimensions(954, 750, 0)).toEqual({
			width: 954,
			height: 750,
		});
		expect(rotatedDJImageDimensions(954, 750, 90)).toEqual({
			width: 750,
			height: 954,
		});
		expect(rotatedDJImageDimensions(954, 750, 180)).toEqual({
			width: 954,
			height: 750,
		});
		expect(rotatedDJImageDimensions(954, 750, 270)).toEqual({
			width: 750,
			height: 954,
		});
	});
});
