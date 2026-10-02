import { expect, test } from "@playwright/test";

test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});
const tags = [
	{ id: 7, title: "Deletion target", color: "#123456", reviewed: true },
	{ id: 8, title: "Deletion remaining", color: "#abcdef", reviewed: true },
];
const impact = {
	tag: { id: 7, title: tags[0].title },
	shows: [{ id: 1, title: "Linked Show" }],
	djs: [
		{ id: 2, title: "Direct DJ", assignment: "direct" },
		{ id: 3, title: "Inherited DJ", assignment: "inherited" },
		{ id: 4, title: "Combined DJ", assignment: "both" },
	],
};
const row = (page: import("@playwright/test").Page) =>
	page
		.getByRole("row")
		.filter({ has: page.getByText(tags[0].title, { exact: true }) });
const dialog = (page: import("@playwright/test").Page) =>
	page.getByRole("alertdialog", { name: "Delete Tag?" });
test.beforeEach(async ({ page }) => {
	await page.route("**/api/admin/tags", (route) =>
		route.fulfill({ json: tags }),
	);
	await page.route("**/api/admin/tags/7/delete-impact", (route) =>
		route.fulfill({ json: impact }),
	);
	await page.goto("/admin/#tags");
	await expect(row(page)).toBeVisible();
});

test("lists direct and inherited impact, contains focus, and restores focus on cancellation", async ({
	page,
}) => {
	let deletes = 0;
	await page.route("**/api/admin/remove-tag", (route) => {
		deletes++;
		return route.fulfill({ json: { id: 7 } });
	});
	const opener = row(page).getByRole("button", { name: "Delete", exact: true });
	for (const dismiss of ["Cancel", "Escape", "Backdrop"]) {
		await opener.click();
		const modal = dialog(page);
		await expect(
			modal.getByRole("button", { name: "Delete", exact: true }),
		).toBeEnabled();
		await expect(modal.getByRole("button", { name: "Cancel" })).toBeFocused();
		await expect(
			modal.getByRole("region", { name: "Affected Shows" }),
		).toContainText("Linked Show (#1)");
		await expect(
			modal.getByRole("region", { name: "Affected DJs" }),
		).toContainText("Inherited DJ (#3) — inherited through Shows");
		await expect(modal).toContainText(
			"Combined DJ (#4) — direct and inherited through Shows",
		);
		await page.keyboard.press("Shift+Tab");
		await expect(
			modal.getByRole("button", { name: "Delete", exact: true }),
		).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(modal.getByRole("button", { name: "Cancel" })).toBeFocused();
		if (dismiss === "Cancel")
			await modal.getByRole("button", { name: "Cancel" }).click();
		else if (dismiss === "Escape") await page.keyboard.press("Escape");
		else
			await page
				.getByRole("button", { name: "Dismiss message" })
				.click({ position: { x: 1, y: 1 } });
		await expect(modal).toBeHidden();
		await expect(opener).toBeFocused();
	}
	expect(deletes).toBe(0);
});

test("impact failures retry, late responses are ignored, and empty lists are explicit", async ({
	page,
}) => {
	let calls = 0;
	let release: (() => void) | undefined;
	await page.route("**/api/admin/tags/7/delete-impact", async (route) => {
		calls++;
		if (calls === 1) {
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			await route.fulfill({ json: impact });
		} else if (calls === 2)
			await route.fulfill({
				status: 500,
				json: { error: "Internal Server Error" },
			});
		else await route.fulfill({ json: { ...impact, shows: [], djs: [] } });
	});
	await row(page).getByRole("button", { name: "Delete", exact: true }).click();
	await expect(dialog(page)).toContainText("Loading affected");
	await expect(
		dialog(page).getByRole("button", { name: "Delete", exact: true }),
	).toBeDisabled();
	await expect.poll(() => release !== undefined).toBe(true);
	await page.keyboard.press("Escape");
	await row(page).getByRole("button", { name: "Delete", exact: true }).click();
	await expect(dialog(page).getByRole("alert")).toContainText("HTTP 500");
	release?.();
	await expect(
		dialog(page).getByRole("button", { name: "Delete", exact: true }),
	).toBeDisabled();
	await dialog(page).getByRole("button", { name: "Retry" }).click();
	await expect(dialog(page)).toContainText("No Shows affected");
	await expect(dialog(page)).toContainText("No DJs affected");
	await expect(
		dialog(page).getByRole("button", { name: "Delete", exact: true }),
	).toBeEnabled();
});

test("pending deletion blocks dismissal and duplicate requests, failed deletion retries without losing search or sort", async ({
	page,
}) => {
	let deletes = 0;
	let release: (() => void) | undefined;
	await page.route("**/api/admin/remove-tag", async (route) => {
		deletes++;
		expect(route.request().postDataJSON()).toEqual({ id: 7 });
		if (deletes === 1) {
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			await route.fulfill({
				status: 500,
				json: { error: "Internal Server Error" },
			});
		} else await route.fulfill({ json: { id: 7 } });
	});
	await page.getByRole("textbox", { name: "Search Tags" }).fill("Deletion");
	await page.getByRole("button", { name: /^title/ }).click();
	await row(page).getByRole("button", { name: "Delete", exact: true }).click();
	await dialog(page)
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(
		dialog(page).getByRole("button", { name: "Deleting…" }),
	).toBeDisabled();
	await expect(
		dialog(page).getByRole("button", { name: "Cancel" }),
	).toBeDisabled();
	await page.keyboard.press("Escape");
	await page
		.getByRole("button", { name: "Dismiss message" })
		.click({ position: { x: 1, y: 1 } });
	await expect(dialog(page)).toBeVisible();
	await expect.poll(() => release !== undefined).toBe(true);
	expect(deletes).toBe(1);
	release?.();
	await expect(dialog(page).getByRole("alert")).toContainText("HTTP 500");
	await dialog(page)
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(dialog(page)).toBeHidden();
	await expect(row(page)).toHaveCount(0);
	await expect(page.getByRole("textbox", { name: "Search Tags" })).toHaveValue(
		"Deletion",
	);
	await expect(
		page.getByRole("textbox", { name: "Search Tags" }),
	).toBeFocused();
	await expect(
		page.getByRole("columnheader", { name: /^title/ }),
	).toHaveAttribute("aria-sort", "ascending");
	await expect(page.getByText(tags[1].title, { exact: true })).toBeVisible();
	expect(deletes).toBe(2);
});

for (const width of [390, 320])
	test(`long impact lists and actions are reachable at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await page.route("**/api/admin/tags/7/delete-impact", (route) =>
			route.fulfill({
				json: {
					...impact,
					shows: Array.from({ length: 30 }, (_, id) => ({
						id,
						title: `Long Show ${id} ${"x".repeat(80)}`,
					})),
				},
			}),
		);
		await row(page)
			.getByRole("button", { name: "Delete", exact: true })
			.click();
		const modal = dialog(page);
		await expect(modal).toContainText("Shows (30)");
		await expect(
			modal.getByRole("button", { name: "Delete", exact: true }),
		).toBeInViewport();
		await expect(
			modal.getByRole("button", { name: "Cancel" }),
		).toBeInViewport();
		expect(
			await modal.evaluate(
				(element) => element.scrollWidth <= element.clientWidth,
			),
		).toBe(true);
		await modal.getByRole("button", { name: "Cancel" }).click();
	});
