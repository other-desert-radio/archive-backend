import { describe, expect, test } from "bun:test";
import { UserPreferences } from "../../src/admin-ui/user-preferences.js";

const createStorage = (initialValue?: string) => {
	let value = initialValue ?? null;
	return {
		getItem: () => value,
		setItem: (_key: string, nextValue: string) => {
			value = nextValue;
		},
		getValue: () => value,
	};
};

describe("admin user preferences", () => {
	test("defaults each resource view to the table", () => {
		const preferences = new UserPreferences(() => undefined);

		expect(preferences.getResourceViewMode("djs")).toBe("table");
		expect(preferences.getResourceViewMode("shows")).toBe("table");
		expect(preferences.getResourceViewMode("tags")).toBe("table");
	});

	test("persists DJ, Shows, and Tags view modes independently", () => {
		const storage = createStorage();
		const preferences = new UserPreferences(() => storage);

		preferences.setResourceViewMode("djs", "grid");
		preferences.setResourceViewMode("shows", "table");
		preferences.setResourceViewMode("tags", "grid");

		expect(JSON.parse(storage.getValue() ?? "{}")).toEqual({
			djsViewMode: "grid",
			showsViewMode: "table",
			tagsViewMode: "grid",
		});
		expect(new UserPreferences(() => storage).getResourceViewMode("djs")).toBe(
			"grid",
		);
		expect(new UserPreferences(() => storage).getResourceViewMode("tags")).toBe(
			"grid",
		);
	});

	test("ignores malformed or unsupported stored values", () => {
		const malformed = new UserPreferences(() => createStorage("not json"));
		const unsupported = new UserPreferences(() =>
			createStorage(JSON.stringify({ djsViewMode: "cards" })),
		);

		expect(malformed.getResourceViewMode("djs")).toBe("table");
		expect(unsupported.getResourceViewMode("djs")).toBe("table");
	});
});
