import { describe, expect, test } from "bun:test";
import { getDatabaseTableViewError } from "../../src/admin-ui/components/database-table-view.js";

describe("database table view messages", () => {
	test("uses the resource title for a generic load error", () => {
		expect(getDatabaseTableViewError("Shows")).toBe(
			"The Shows could not be loaded.",
		);
		expect(getDatabaseTableViewError("DJs")).toBe(
			"The DJs could not be loaded.",
		);
	});
});
