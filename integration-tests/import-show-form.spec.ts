import { rm } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { buildSharedModalFixture } from "./fixtures/build-shared-modal.js";
import {
	fixtureDJs,
	fixtureTags,
	resolvedTags,
} from "./fixtures/import-show-data.js";

test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
	timezoneId: "America/Los_Angeles",
});
let fixture: Awaited<ReturnType<typeof buildSharedModalFixture>>;
test.beforeAll(async () => {
	fixture = await buildSharedModalFixture(
		"integration-tests/fixtures/import-show.tsx",
	);
});
test.afterAll(async () => {
	if (fixture) await rm(fixture.directory, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
	await page.route("**/admin/__modal-test/**", async (route) => {
		const name = new URL(route.request().url()).pathname.replace(
			"/admin/__modal-test/",
			"",
		);
		if (!name)
			return route.fulfill({ contentType: "text/html", body: fixture.html });
		const body = fixture.assets.get(name);
		return route.fulfill({
			status: body ? 200 : 404,
			contentType: name.endsWith(".js")
				? "text/javascript"
				: name.endsWith(".css")
					? "text/css"
					: "application/octet-stream",
			body: body ?? "",
		});
	});
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
		route.fulfill({
			json: route.request().postDataJSON().mixcloud_keys.length
				? resolvedTags
				: { valid: [], invalid: [] },
		}),
	);
	await page.goto("/admin/__modal-test/");
});

test("prefills exact matches, canonical chips, approved source data, and submits full metadata", async ({
	page,
}) => {
	let payload: Record<string, unknown> | undefined;
	const tagPayloads: unknown[] = [];
	await page.route("**/api/admin/create-tag", (route) => {
		tagPayloads.push(route.request().postDataJSON());
		return route.fulfill({
			status: 201,
			json: { id: 101, title: "New Genre", color: "#aabbcc", reviewed: false },
		});
	});
	await page.route("**/api/admin/create-show", async (route) => {
		payload = route.request().postDataJSON();
		await route.fulfill({ status: 201, json: { id: 99, ...payload } });
	});
	await page.getByRole("button", { name: "Open import" }).click();
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeEnabled();
	await expect(page.getByLabel("title", { exact: true })).toHaveValue(
		"Suggested title",
	);
	await expect(page.getByLabel("date", { exact: true })).toHaveValue(
		"2026-10-01",
	);
	await expect(page.getByLabel("duration (seconds)")).toHaveValue("3661");
	await expect(
		page.getByRole("checkbox", { name: "Known DJ (#1)" }),
	).toBeChecked();
	await expect(
		page.getByText("Unmatched DJs: Missing DJ, Ambiguous DJ"),
	).toBeVisible();
	await expect(
		page.getByText("Unmatched DJs: Missing DJ, Ambiguous DJ"),
	).toHaveCSS("font-weight", "700");
	await expect(
		page.getByText("you'll need to onboard this DJ separately first"),
	).toBeVisible();
	await expect(
		page.getByText(
			"The tag “New Genre” does not exist elsewhere. It will be created after submit.",
		),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Remove Ambient", exact: true }),
	).toBeVisible();
	await expect(
		page
			.getByRole("button", { name: "Remove Ambient", exact: true })
			.locator(".."),
	).toHaveCSS("background-color", "rgb(170, 187, 204)");
	const unknownChip = page
		.getByRole("button", { name: "Remove New Genre", exact: true })
		.locator("..");
	await expect(unknownChip).toHaveCSS("color", "rgb(255, 0, 0)");
	await expect(unknownChip).toHaveCSS("border-color", "rgb(255, 0, 0)");
	await expect(
		page.getByText("1 hours, 1 minutes, 1 seconds", { exact: true }),
	).toHaveCSS("color", "rgb(85, 85, 85)");
	await page.getByLabel("duration (seconds)").fill("62");
	await expect(
		page.getByText("0 hours, 1 minutes, 2 seconds", { exact: true }),
	).toBeVisible();
	await page.getByLabel("duration (seconds)").fill("3661");
	await expect(page.locator("dl dt")).toHaveText([
		"name",
		"url",
		"created_time",
		"duration",
		"mixcloud_tag_json",
	]);
	await expect(
		page.getByRole("region", { name: "MIXCLOUD DATA" }).getByRole("link"),
	).toHaveAttribute("href", /^https:\/\/www.mixcloud.com\//);
	await expect(
		page.locator(
			'input[name="image_small"], input[name="image_large"], input[name="url"]',
		),
	).toHaveCount(0);
	await page
		.getByRole("combobox", { name: "tags", exact: true })
		.fill("New Tag");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByLabel("Imported Show")).toHaveText("Suggested title");
	expect(tagPayloads).toEqual([
		{
			title: "New Genre",
			mixcloud_key: "/genres/unresolved/",
			mixcloud_url: "https://www.mixcloud.com/genres/unresolved/",
		},
	]);
	expect(payload).toMatchObject({
		mixcloud_import_id: 7,
		title: "Suggested title",
		date: "2026-10-01",
		duration: 3661,
		djs: [1],
		tags: ["Ambient", "New Genre", "New Tag"],
		image_small: "https://example.test/small",
		image_large: "https://example.test/large",
	});
	expect(payload?.url).toMatch(
		/^https:\/\/www.mixcloud.com\/otherdesertradio\//,
	);
});

test("resolved opening selections are clean and item changes reset fields, helpers, and searches", async ({
	page,
}) => {
	await page.getByRole("button", { name: "Open import" }).click();
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeEnabled();
	await page.getByRole("searchbox", { name: "Search DJs" }).fill("No matches");
	await page.getByRole("button", { name: "Next Show" }).click();
	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await expect(page.getByLabel("title", { exact: true })).toHaveValue(
		"Second source",
	);
	await expect(page.getByRole("searchbox", { name: "Search DJs" })).toHaveValue(
		"",
	);
	await expect(page.getByLabel("date", { exact: true })).toHaveValue("");
	await expect(page.getByLabel("duration (seconds)")).toHaveValue("");
	await expect(page.getByText(/Unmatched DJs:/)).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Remove Ambient" }),
	).toHaveCount(0);
});

test("resolution failure disables Save and Retry preserves metadata edits", async ({
	page,
}) => {
	let attempts = 0;
	await page.route("**/api/admin/validate-tags", (route) =>
		route.fulfill(
			++attempts === 1
				? { status: 500, json: { error: "Failed" } }
				: { json: resolvedTags },
		),
	);
	await page.getByRole("button", { name: "Open import" }).click();
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	await page.getByLabel("title", { exact: true }).fill("Edited while loading");
	await page.getByRole("button", { name: "Retry source suggestions" }).click();
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeEnabled();
	await expect(page.getByLabel("title", { exact: true })).toHaveValue(
		"Edited while loading",
	);
	await page.getByRole("button", { name: "Skip", exact: true }).click();
	await expect(page.getByRole("alertdialog")).toBeVisible();
});

test("tag choices retry preserves resolved selections and metadata", async ({
	page,
}) => {
	let attempts = 0;
	await page.route("**/api/admin/tags", (route) =>
		route.fulfill(++attempts === 1 ? { status: 500 } : { json: fixtureTags }),
	);
	await page.getByRole("button", { name: "Open import" }).click();
	await expect(
		page.getByRole("button", { name: "Remove Ambient" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	await page.getByLabel("title", { exact: true }).fill("Retained");
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeEnabled();
	await expect(page.getByLabel("title", { exact: true })).toHaveValue(
		"Retained",
	);
});

test("late source responses after replacement cannot change the next item", async ({
	page,
}) => {
	let release: (() => void) | undefined;
	await page.route("**/api/admin/validate-tags", async (route) => {
		if (route.request().postDataJSON().mixcloud_keys.length) {
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			await route.fulfill({ json: resolvedTags });
		} else await route.fulfill({ json: { valid: [], invalid: [] } });
	});
	await page.getByRole("button", { name: "Open import" }).click();
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	await expect.poll(() => Boolean(release)).toBe(true);
	await page.getByRole("button", { name: "Next Show" }).click();
	await expect(page.getByLabel("title", { exact: true })).toHaveValue(
		"Second source",
	);
	release?.();
	await expect(
		page.getByRole("checkbox", { name: "Second DJ (#4)" }),
	).toBeChecked();
	await expect(
		page.getByRole("button", { name: "Remove Ambient" }),
	).toHaveCount(0);
	await expect(page.getByText(/Unresolved Mixcloud keys:/)).toHaveCount(0);
});

test("failed Save retains values and an already-imported 200 succeeds on retry", async ({
	page,
}) => {
	let attempts = 0;
	await page.route("**/api/admin/create-show", (route) =>
		route.fulfill(
			++attempts === 1
				? { status: 500, json: { error: "Failure" } }
				: { status: 200, json: { id: 99, title: "Existing Show" } },
		),
	);
	await page.getByRole("button", { name: "Open import" }).click();
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeEnabled();
	await page.getByLabel("title", { exact: true }).fill("Retain draft");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(page.getByLabel("title", { exact: true })).toHaveValue(
		"Retain draft",
	);
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByLabel("Imported Show")).toHaveText("Existing Show");
});

for (const width of [1280, 390, 320])
	test(`source wrapping and reachable actions at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await page.getByRole("button", { name: "Open import" }).click();
		await expect(
			page.getByRole("button", { name: "Save", exact: true }),
		).toBeEnabled();
		await page
			.getByRole("button", { name: "Skip", exact: true })
			.scrollIntoViewIfNeeded();
		await expect(
			page.getByRole("button", { name: "Skip", exact: true }),
		).toBeVisible();
		const dialog = page.getByRole("dialog");
		expect(
			await dialog.locator("form").evaluate((element) => {
				const panel = element.parentElement;
				return panel !== null && panel.scrollWidth <= panel.clientWidth;
			}),
		).toBe(true);
		await page.getByRole("button", { name: "Close", exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(
			page.getByRole("button", { name: "Open import" }),
		).toBeFocused();
	});

test("unresolved source keys reuse matching tag names and colors, and only new names are created", async ({
	page,
}) => {
	await page.route("**/api/admin/validate-tags", (route) =>
		route.fulfill({
			json: { valid: [], invalid: ["/genres/ambient/", "/genres/new-genre/"] },
		}),
	);
	let payload: { tags: string[] } | undefined;
	await page.route("**/api/admin/create-show", (route) => {
		payload = route.request().postDataJSON();
		return route.fulfill({
			status: 201,
			json: { id: 99, title: "Suggested title" },
		});
	});
	await page.getByRole("button", { name: "Open import" }).click();
	await expect(
		page.getByRole("button", { name: "Save", exact: true }),
	).toBeEnabled();
	await expect(
		page
			.getByRole("button", { name: "Remove Ambient", exact: true })
			.locator(".."),
	).toHaveCSS("background-color", "rgb(170, 187, 204)");
	await expect(
		page
			.getByRole("button", { name: "Remove MiXeD Genre", exact: true })
			.locator(".."),
	).toHaveCSS("color", "rgb(255, 0, 0)");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByLabel("Imported Show")).toHaveText("Suggested title");
	expect(payload?.tags).toEqual(["Ambient", "MiXeD Genre"]);
});
