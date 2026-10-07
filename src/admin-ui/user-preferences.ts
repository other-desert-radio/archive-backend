import type { ResourceViewMode } from "./components/shared/resource-views/index.js";

type BrowserStorage = Pick<Storage, "getItem" | "setItem">;
export type ResourceViewPreference = "djs" | "shows" | "tags";

type StoredUserPreferences = Partial<{
	djsViewMode: ResourceViewMode;
	showsViewMode: ResourceViewMode;
	tagsViewMode: ResourceViewMode;
}>;

const storageKey = "odr-admin-user-preferences";
const defaultViewMode: ResourceViewMode = "table";

const isResourceViewMode = (value: unknown): value is ResourceViewMode =>
	value === "grid" || value === "table";

const getBrowserStorage = (): BrowserStorage | undefined => {
	try {
		return globalThis.localStorage;
	} catch {
		return undefined;
	}
};

/** Stores browser-only preferences shared by the admin resource views. */
export class UserPreferences {
	constructor(
		private readonly getStorage: () =>
			| BrowserStorage
			| undefined = getBrowserStorage,
	) {}

	getResourceViewMode(resource: ResourceViewPreference): ResourceViewMode {
		const storedMode = this.read()[`${resource}ViewMode`];
		return isResourceViewMode(storedMode) ? storedMode : defaultViewMode;
	}

	setResourceViewMode(
		resource: ResourceViewPreference,
		viewMode: ResourceViewMode,
	): void {
		const storage = this.getStorage();
		if (storage === undefined) return;

		try {
			storage.setItem(
				storageKey,
				JSON.stringify({ ...this.read(), [`${resource}ViewMode`]: viewMode }),
			);
		} catch {
			// Storage can be unavailable in private browsing or when quota is exceeded.
		}
	}

	private read(): StoredUserPreferences {
		const storage = this.getStorage();
		if (storage === undefined) return {};

		try {
			const value: unknown = JSON.parse(storage.getItem(storageKey) ?? "{}");
			return typeof value === "object" && value !== null ? value : {};
		} catch {
			return {};
		}
	}
}

export const userPreferences = new UserPreferences();
