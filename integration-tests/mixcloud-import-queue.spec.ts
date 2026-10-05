import { expect, test } from "@playwright/test";
import type { MixcloudImportAdminRow } from "../src/admin-ui/loaders/mixcloud-imports.js";
import {
	fixtureDJs,
	fixtureTags,
	importRows,
	resolvedTags,
} from "./fixtures/import-show-data.js";

test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});
const ready = (id: number): MixcloudImportAdminRow => ({
	...importRows[0],
	key: "/queue-source/",
	data_changed: false,
	djs: [],
	dj_names: [],
	tags: [],
	id,
	name: `Source ${id}`,
	derived_title: `Ready ${id}`,
	decoded_djs: ["Known DJ"],
	parser_version: 1,
	parser_key: "test",
	date_source: "title",
});
const review = (id: number): MixcloudImportAdminRow => ({
	...ready(id),
	derived_title: `Review ${id}`,
	date_source: "created_time",
});

type State = {
	rows: MixcloudImportAdminRow[];
	posts: number;
	failSave: boolean;
	failReload: boolean;
	alreadyImported: boolean;
	release?: () => void;
	hold: boolean;
	listReads: number;
	refreshPosts: number;
};
let state: State;
test.beforeEach(async ({ page }) => {
	state = {
		rows: [
			ready(9),
			review(4),
			ready(2),
			{ ...ready(1), show_id: 77, imported_at: "2026-10-01T00:00:00Z" },
			review(6),
		],
		posts: 0,
		failSave: false,
		failReload: false,
		alreadyImported: false,
		hold: false,
		listReads: 0,
		refreshPosts: 0,
	};
	await page.route("**/api/admin/mixcloud-imports", (route) => {
		state.listReads++;
		return route.fulfill(
			state.failReload ? { status: 500 } : { json: state.rows },
		);
	});
	await page.route("**/api/admin/mixcloud-import/status", (route) =>
		route.fulfill({
			json: {
				auto_parsed: state.rows.filter(
					(row) => row.show_id === undefined && row.date_source === "title",
				).length,
				unparsable: state.rows.filter(
					(row) => row.show_id === undefined && row.date_source !== "title",
				).length,
			},
		}),
	);
	await page.route("**/api/admin/djs", (route) =>
		route.fulfill({ json: fixtureDJs }),
	);
	await page.route("**/api/admin/create-tag", (route) =>
		route.fulfill({
			status: 201,
			json: {
				id: 101,
				color: "#aabbcc",
				reviewed: false,
				...route.request().postDataJSON(),
			},
		}),
	);
	await page.route("**/api/admin/tags", (route) =>
		route.fulfill({ json: fixtureTags }),
	);
	await page.route("**/api/admin/validate-tags", (route) =>
		route.fulfill({ json: resolvedTags }),
	);
	await page.route("**/api/admin/refresh-mixcloud", (route) => {
		state.refreshPosts++;
		return route.fulfill({ json: { status: "ok" } });
	});
	await page.route("**/api/admin/create-show", async (route) => {
		state.posts++;
		const payload = route.request().postDataJSON();
		if (state.hold)
			await new Promise<void>((resolve) => {
				state.release = resolve;
			});
		if (state.failSave)
			return route.fulfill({ status: 500, json: { error: "Failure" } });
		const show = {
			id: 100 + payload.mixcloud_import_id,
			createdAt: "2026-10-01T00:00:00Z",
			...payload,
			date: `${payload.date}T00:00:00Z`,
			tags: [10],
			djs: payload.djs,
		};
		state.rows = state.rows.map((row) =>
			row.id === payload.mixcloud_import_id
				? {
						...row,
						show_id: show.id,
						imported_at: "2026-10-01T00:00:00Z",
						data_changed: false,
						show_name: show.title,
					}
				: row,
		);
		return route.fulfill({
			status: state.alreadyImported ? 200 : 201,
			json: show,
		});
	});
	await page.goto("/admin/#mixcloud");
	await expect(
		page.getByRole("button", { name: /^ready for import/ }),
	).toBeEnabled();
});

const sourceId = (page: import("@playwright/test").Page) =>
	page
		.locator("dl > div")
		.filter({ has: page.locator("dt", { hasText: /^name$/ }) })
		.locator("dd");
const launch = (
	page: import("@playwright/test").Page,
	category = "ready for import",
) => page.getByRole("button", { name: new RegExp(`^${category}`) }).click();
const save = (page: import("@playwright/test").Page) =>
	page.getByRole("button", { name: "Save", exact: true });

test("both launchers queue all pending category rows in ID order regardless of search/sort", async ({
	page,
}) => {
	await page.getByRole("textbox", { name: "Search Mixcloud" }).fill("Ready 9");
	await page.getByRole("button", { name: /^ID / }).click();
	await launch(page);
	await expect(sourceId(page)).toHaveText("Source 2");
	await expect(page.getByText("2 remaining", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Next Show" }).click();
	await expect(sourceId(page)).toHaveText("Source 9");
	await page.getByRole("button", { name: "Close", exact: true }).click();
	await expect(
		page.getByRole("textbox", { name: "Search Mixcloud" }),
	).toHaveValue("Ready 9");
	await expect(page.locator("tbody tr")).toHaveCount(1);
	await launch(page, "needs review");
	await expect(sourceId(page)).toHaveText("Source 4");
	await page.getByRole("button", { name: "Next Show" }).click();
	await expect(sourceId(page)).toHaveText("Source 6");
	await page.getByRole("button", { name: "Skip", exact: true }).click();
	await expect(page.getByRole("dialog")).toBeHidden();
	await expect(
		page.getByRole("button", { name: /^needs review/ }),
	).toBeFocused();
	expect(state.posts).toBe(0);
});

test("Skip preserves counts, skipped rows return on reopen, and final Skip closes", async ({
	page,
}) => {
	await launch(page);
	await expect(save(page)).toBeEnabled();
	await page.getByRole("button", { name: "Skip", exact: true }).click();
	await expect(sourceId(page)).toHaveText("Source 9");
	await expect(page.getByText("2 remaining", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Skip", exact: true }).click();
	await expect(page.getByRole("dialog")).toBeHidden();
	await expect(
		page.getByRole("button", { name: /^ready for import/ }),
	).toBeFocused();
	await launch(page);
	await expect(sourceId(page)).toHaveText("Source 2");
	expect(state.posts).toBe(0);
	expect(state.listReads).toBe(1);
});

for (const repeated of [false, true])
	test(`Save reduces counts, excludes imported rows, and final Save closes (200=${repeated})`, async ({
		page,
	}) => {
		state.alreadyImported = repeated;
		await page.getByRole("button", { name: /^ID / }).click();
		await launch(page);
		await expect(save(page)).toBeEnabled();
		await save(page).click();
		await expect(sourceId(page)).toHaveText("Source 9");
		await expect(page.getByText("1 remaining", { exact: true })).toBeVisible();
		await expect(save(page)).toBeEnabled();
		await save(page).click();
		await expect(page.getByRole("dialog")).toBeHidden();
		await expect(
			page.getByRole("button", { name: /^ready for import/ }),
		).toBeFocused();
		await expect(
			page.getByRole("button", { name: /^ready for import/ }).locator("span"),
		).toHaveCount(0);
		expect(state.posts).toBe(2);
		await expect.poll(() => state.listReads).toBe(3);
		await expect(page.locator("tbody tr").first()).toContainText("Ready 9");
		await launch(page);
		await expect(
			page.getByRole("dialog", { name: "No pending imports" }),
		).toBeVisible();
		await page.getByRole("button", { name: "OK", exact: true }).click();
		await expect(
			page.getByRole("button", { name: /^ready for import/ }),
		).toBeFocused();
	});

test("dirty Skip and arrow require confirmation; reverting clears dirty state", async ({
	page,
}) => {
	await launch(page);
	await expect(save(page)).toBeEnabled();
	for (const action of ["Skip", "Next Show"]) {
		await page.getByLabel("title", { exact: true }).fill("Draft");
		const button = page.getByRole("button", { name: action, exact: true });
		await button.click();
		await expect(page.getByRole("alertdialog")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Keep editing" }),
		).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(button).toBeFocused();
		await expect(sourceId(page)).toHaveText("Source 2");
	}
	await page.getByRole("button", { name: "Next Show" }).click();
	await page.getByRole("button", { name: "Discard changes" }).click();
	await expect(sourceId(page)).toHaveText("Source 9");
	await page.getByLabel("title", { exact: true }).fill("Changed");
	await page.getByLabel("title", { exact: true }).fill("Ready 9");
	await page.getByRole("button", { name: "Skip", exact: true }).click();
	await expect(page.getByRole("dialog")).toBeHidden();
	expect(state.posts).toBe(0);
});

test("pending Save blocks duplicates, navigation, dismissal, and background refresh; failure retries", async ({
	page,
}) => {
	state.hold = true;
	state.failSave = true;
	await launch(page);
	await expect(save(page)).toBeEnabled();
	await page.getByLabel("title", { exact: true }).fill("Retained draft");
	await save(page).click();
	await expect.poll(() => Boolean(state.release)).toBe(true);
	for (const name of ["Saving…", "Skip", "Next Show", "Close"])
		await expect(
			page.getByRole("button", { name, exact: true }),
		).toBeDisabled();
	await page.keyboard.press("Escape");
	await expect(sourceId(page)).toHaveText("Source 2");
	await expect(
		page.locator("button").filter({ hasText: /^Refresh Mixcloud$/ }),
	).toBeDisabled();
	await page.evaluate(() =>
		document
			.querySelector("form")
			?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
	);
	expect(state.posts).toBe(1);
	expect(state.refreshPosts).toBe(0);
	state.release?.();
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(page.getByLabel("title", { exact: true })).toHaveValue(
		"Retained draft",
	);
	state.hold = false;
	state.failSave = false;
	await save(page).click();
	await expect(sourceId(page)).toHaveText("Source 9");
	expect(state.posts).toBe(2);
});

test("a committed Save advances despite reload failure and retains local tracking until retry", async ({
	page,
}) => {
	await launch(page);
	await expect(save(page)).toBeEnabled();
	state.failReload = true;
	await save(page).click();
	await expect(sourceId(page)).toHaveText("Source 9");
	await expect(page.getByText("1 remaining", { exact: true })).toBeVisible();
	await expect(page.getByRole("dialog").getByRole("alert")).toHaveCount(0);
	await page.getByRole("button", { name: "Close", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText("Show imported, but");
	await launch(page);
	await expect(sourceId(page)).toHaveText("Source 9");
	await page.getByRole("button", { name: "Close", exact: true }).click();
	state.failReload = false;
	await page.getByRole("button", { name: "Reload import list" }).click();
	await expect(page.getByRole("alert")).toHaveCount(0);
	expect(state.posts).toBe(1);
});

for (const path of ["close", "escape", "backdrop"])
	test(`dirty ${path} protects edits and closure restores launcher focus`, async ({
		page,
	}) => {
		await launch(page);
		await expect(save(page)).toBeEnabled();
		await page.getByLabel("title", { exact: true }).fill("Draft");
		if (path === "close")
			await page.getByRole("button", { name: "Close", exact: true }).click();
		if (path === "escape") await page.keyboard.press("Escape");
		if (path === "backdrop")
			await page
				.getByRole("button", { name: "Cancel form" })
				.click({ position: { x: 2, y: 2 } });
		await expect(page.getByRole("alertdialog")).toBeVisible();
		await page.getByRole("button", { name: "Discard changes" }).click();
		await expect(page.getByRole("dialog")).toBeHidden();
		await expect(
			page.getByRole("button", { name: /^ready for import/ }),
		).toBeFocused();
	});

for (const width of [390, 320])
	test(`queue actions and keyboard focus stay reachable at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await launch(page);
		await expect(save(page)).toBeEnabled();
		await page
			.getByRole("button", { name: "Skip", exact: true })
			.scrollIntoViewIfNeeded();
		await expect(
			page.getByRole("button", { name: "Skip", exact: true }),
		).toBeVisible();
		const next = page.getByRole("button", { name: "Next Show" });
		await next.focus();
		await page.keyboard.press("Tab");
		await expect(
			page.getByRole("button", { name: "Close", exact: true }),
		).toBeFocused();
		await page.keyboard.press("Shift+Tab");
		await expect(next).toBeFocused();
		const bounds = await next.boundingBox();
		expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
	});

test("an older post-import reload cannot overwrite a later committed import", async ({
	page,
}) => {
	let releaseOlder: (() => void) | undefined;
	await page.route("**/api/admin/mixcloud-imports", async (route) => {
		state.listReads++;
		const snapshot = structuredClone(state.rows);
		if (state.listReads === 2)
			await new Promise<void>((resolve) => {
				releaseOlder = resolve;
			});
		await route.fulfill({ json: snapshot });
	});
	await launch(page);
	await expect(save(page)).toBeEnabled();
	await save(page).click();
	await expect(sourceId(page)).toHaveText("Source 9");
	await expect.poll(() => Boolean(releaseOlder)).toBe(true);
	await expect(save(page)).toBeEnabled();
	await save(page).click();
	await expect(page.getByRole("dialog")).toBeHidden();
	await expect.poll(() => state.listReads).toBe(3);
	const oldResponse = page.waitForResponse(async (response) => {
		if (!response.url().endsWith("/api/admin/mixcloud-imports")) return false;
		const rows = await response.json();
		return rows.some(
			(row: MixcloudImportAdminRow) =>
				row.id === 9 && row.show_id === undefined,
		);
	});
	releaseOlder?.();
	await (await oldResponse).finished();
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
	);
	await expect(
		page.getByRole("button", { name: /^ready for import/ }).locator("span"),
	).toHaveCount(0);
	await launch(page);
	await expect(
		page.getByRole("dialog", { name: "No pending imports" }),
	).toBeVisible();
});

test("success toast shows saved metadata, resets for the next save, fades and dismisses", async ({
	page,
}) => {
	await page.clock.install();
	await launch(page);
	await expect(save(page)).toBeEnabled();
	await save(page).click();
	const toast = page
		.getByRole("status")
		.filter({ hasText: "Successfully created show:" });
	await expect(toast).toContainText("Ready 2");
	await expect(toast).toContainText("2026-10-01 · 3661 seconds · 1 DJ · 1 tag");
	await page.clock.fastForward(3000);
	await expect(save(page)).toBeEnabled();
	await save(page).click();
	await expect(toast).toContainText("Ready 9");
	await page.clock.fastForward(3999);
	await expect(toast.locator("..")).toHaveCSS("opacity", "1");
	await page.clock.fastForward(251);
	await expect(toast).toHaveCount(0);
});

test("success toast close button dismisses immediately", async ({ page }) => {
	await launch(page);
	await expect(save(page)).toBeEnabled();
	await save(page).click();
	await page.getByRole("button", { name: "Dismiss notification" }).click();
	await expect(page.getByText(/Successfully created show:/)).toHaveCount(0);
});

test("source tag JSON replaces tag keys in the database table", async ({
	page,
}) => {
	const headers = page.getByRole("columnheader");
	const labels = await headers.allTextContents();
	const keysIndex = labels.findIndex((label) =>
		label.startsWith("mixcloud_tag_json"),
	);
	expect(keysIndex).toBeGreaterThanOrEqual(0);
	expect(labels.some((label) => label.startsWith("mixcloud_tag_keys"))).toBe(
		false,
	);
	const row = page
		.locator("tbody tr")
		.filter({ has: page.getByRole("cell", { name: "Source 2", exact: true }) });
	const jsonCell = row.getByRole("cell").nth(keysIndex);
	await expect(jsonCell).toHaveText(
		JSON.stringify(importRows[0]?.mixcloud_tags),
	);
	await page
		.getByRole("textbox", { name: "Search Mixcloud" })
		.fill("MiXeD Genre");
	await expect(row).toBeVisible();
	await page.getByRole("button", { name: /^mixcloud_tag_json/ }).click();
	await expect(headers.nth(keysIndex)).toHaveAttribute(
		"aria-sort",
		"ascending",
	);
});

test("previous arrow revisits skipped items and protects edits", async ({
	page,
}) => {
	await launch(page);
	const previous = page.getByRole("button", { name: "Previous Show" });
	await expect(previous).toBeDisabled();
	await page.getByRole("button", { name: "Next Show" }).click();
	await expect(sourceId(page)).toHaveText("Source 9");
	await expect(save(page)).toBeEnabled();
	await page.getByLabel("title", { exact: true }).fill("Draft");
	await previous.click();
	await expect(page.getByRole("alertdialog")).toBeVisible();
	await page.getByRole("button", { name: "Keep editing" }).click();
	await expect(previous).toBeFocused();
	await previous.click();
	await page.getByRole("button", { name: "Discard changes" }).click();
	await expect(sourceId(page)).toHaveText("Source 2");
	await expect(previous).toBeDisabled();
	await expect(save(page)).toBeEnabled();
	await save(page).click();
	await expect(sourceId(page)).toHaveText("Source 9");
	await expect(previous).toBeDisabled();
	expect(state.posts).toBe(1);
});
