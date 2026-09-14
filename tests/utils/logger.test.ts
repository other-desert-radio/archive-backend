import { describe, expect, test } from "bun:test";
import { logger } from "../../src/utils/index.js";

describe("logger", () => {
	test("exposes the supported log methods", () => {
		expect(typeof logger.debug).toBe("function");
		expect(typeof logger.info).toBe("function");
		expect(typeof logger.warn).toBe("function");
		expect(typeof logger.verbose).toBe("function");
	});
});
