import { expect, test } from "@playwright/test";

test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});

test("refresh preserves table state, blocks duplicate clicks, and surfaces failures", async ({
	page,
}) => {
	let refreshed = false;
	let failRefresh = false;
	let failList = false;
	let posts = 0;
	let release: (() => void) | undefined;
	await page.route("**/api/admin/mixcloud-imports", (route) =>
		route.fulfill({
			status: failList ? 500 : 200,
			json: failList
				? { error: "Internal Server Error" }
				: [1, 2].map((id) => ({
						id,
						key: `/source/${id}/`,
						name: refreshed
							? `Source refreshed ${id}`
							: `Source original ${id}`,
						data_changed: id === 1,
						djs: [],
						dj_names: [],
						tags: [],
					})),
		}),
	);
	await page.route("**/api/admin/refresh-mixcloud", async (route) => {
		posts++;
		expect(route.request().method()).toBe("POST");
		if (posts === 1)
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		if (!failRefresh) refreshed = true;
		await route.fulfill({
			status: failRefresh ? 500 : 200,
			json: failRefresh ? { error: "Internal Server Error" } : { status: "ok" },
		});
	});
	await page.goto("/admin/#mixcloud");
	const search = page.getByRole("textbox", { name: "Search Mixcloud" });
	await search.fill("source");
	await page.getByRole("button", { name: /^ID / }).click();
	await page
		.getByRole("button", { name: "Refresh Mixcloud", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Refreshing Mixcloud…" }),
	).toBeDisabled();
	await expect.poll(() => posts).toBe(1);
	release?.();
	await expect(page.getByRole("status")).toHaveText("Mixcloud refreshed.");
	await expect(search).toHaveValue("source");
	await expect(page.locator("tbody tr").first()).toContainText(
		"Source refreshed 2",
	);
	failRefresh = true;
	await page
		.getByRole("button", { name: "Refresh Mixcloud", exact: true })
		.click();
	await expect(page.getByRole("alert")).toContainText(
		"The server encountered an unexpected error.",
	);
	await expect(page.getByRole("alert")).not.toHaveText("Internal Server Error");
	await expect(page.locator("tbody tr")).toHaveCount(2);
	failRefresh = false;
	failList = true;
	await page
		.getByRole("button", { name: "Refresh Mixcloud", exact: true })
		.click();
	await expect(page.getByRole("alert")).toContainText(
		"Mixcloud refreshed, but the table could not be reloaded.",
	);
	await expect(page.locator("tbody tr")).toHaveCount(2);
	await expect(
		page.getByRole("button", { name: "Refresh Mixcloud", exact: true }),
	).toBeEnabled();
});
