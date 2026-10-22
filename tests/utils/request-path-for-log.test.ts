import { expect, test } from "bun:test";
import { requestPathForLog } from "../../src/utils/index.js";

test("request logs retain only the path, excluding OAuth parameters and fragments", () => {
	expect(
		requestPathForLog(
			"/api/admin/mixcloud/callback?code=private&state=private#private",
		),
	).toBe("/api/admin/mixcloud/callback");
	expect(
		requestPathForLog(
			"https://user:secret@example.test/path?access_token=private",
		),
	).toBe("/path");
	expect(requestPathForLog("/api/admin/shows")).toBe("/api/admin/shows");
	expect(requestPathForLog("http://[")).toBe("[invalid URL]");
});
