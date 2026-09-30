import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});
test("creates a reviewed tag with metadata, reloads, and reuses existing titles", async ({
	page,
	request,
}) => {
	await page.goto("/admin/#tags");
	const title = `Onboard ${randomUUID()}`;
	await page.getByRole("button", { name: "+ tag", exact: true }).click();
	const form = page.getByRole("dialog", { name: "Onboard Tag", exact: true });
	await page.locator("#tag-title").fill(` ${title} `);
	await form.getByLabel("Choose tag color").fill("#123456");
	await page.locator("#tag-mixcloud-key").fill(" key ");
	await page.locator("#tag-mixcloud-url").fill(" https://example.test/genre ");
	await form.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(form).toBeHidden();
	await page.reload();
	await expect(
		page.getByRole("table").getByText(title, { exact: true }),
	).toBeVisible();
	const tags = await (await request.get("/api/admin/tags")).json();
	expect(
		tags.find((tag: { title: string }) => tag.title === title),
	).toMatchObject({
		color: "#123456",
		reviewed: true,
		mixcloud_key: "key",
		mixcloud_url: "https://example.test/genre",
	});
	await page.getByRole("button", { name: "+ tag", exact: true }).click();
	await page.locator("#tag-title").fill(title.toUpperCase());
	await form.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(form).toBeHidden();
	const reloaded = await (await request.get("/api/admin/tags")).json();
	expect(reloaded).toEqual(tags);
});
test("validates locally, retains failed drafts, and protects dirty dismissal on phones", async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 844 });
	await page.goto("/admin/#tags");
	await page.getByRole("button", { name: "+ tag", exact: true }).click();
	const form = page.getByRole("dialog", { name: "Onboard Tag", exact: true });
	await page.locator("#tag-title").fill("Draft");
	await page.locator("#tag-color").fill("#fff");
	await form.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(form.getByRole("alert")).toContainText("six-digit");
	await page.locator("#tag-color").fill("#123456");
	await page.route("**/api/admin/create-tag", (route) =>
		route.fulfill({ status: 500, json: { error: "Internal Server Error" } }),
	);
	await form.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(form.getByRole("alert")).toContainText("could not be created");
	await expect(page.locator("#tag-title")).toHaveValue("Draft");
	expect(
		await form.evaluate((node) => node.scrollWidth <= node.clientWidth),
	).toBe(true);
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Keep editing", exact: true }).click();
	await expect(page.locator("#tag-title")).toHaveValue("Draft");
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await page
		.getByRole("button", { name: "Discard changes", exact: true })
		.click();
	await expect(form).toBeHidden();
	await expect(
		page.getByRole("button", { name: "+ tag", exact: true }),
	).toBeFocused();
});
