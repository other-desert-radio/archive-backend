import { randomUUID } from "node:crypto";
import {
	type APIRequestContext,
	test as base,
	expect,
	type Page,
} from "@playwright/test";

type Tag = {
	id: number;
	title: string;
	color: string;
	reviewed: boolean;
	mixcloud_key?: string;
	mixcloud_url?: string;
};
const loadTag = async (
	request: APIRequestContext,
	id: number,
): Promise<Tag> => {
	const response = await request.get("/api/admin/tags");
	expect(response.ok()).toBeTruthy();
	return (await response.json()).find((tag: Tag) => tag.id === id);
};
const row = (page: Page, resource: string, id: number) =>
	page
		.getByRole("table", { name: resource, exact: true })
		.getByRole("row")
		.filter({
			has: page
				.locator("td:nth-child(2)")
				.filter({ hasText: new RegExp(`^${id}$`) }),
		});
const open = async (page: Page, id: number) => {
	await row(page, "Tags", id)
		.getByRole("button", { name: "Edit", exact: true })
		.click();
	const form = page.getByRole("dialog", { name: "Edit Tag", exact: true });
	await expect(form).toBeVisible();
	return form;
};
const save = async (page: Page) => {
	const response = page.waitForResponse(
		(r) =>
			r.url().endsWith("/api/admin/modify-tag") &&
			r.request().method() === "POST",
	);
	await page.getByRole("button", { name: "Save", exact: true }).click();
	expect((await response).status()).toBe(200);
	await expect(
		page.getByRole("dialog", { name: "Edit Tag", exact: true }),
	).toBeHidden();
};
const test = base.extend<{ tag: Tag; linked: { dj: number; show: number } }>({
	tag: async ({ request }, use) => {
		const response = await request.post("/api/admin/create-tag", {
			data: {
				title: `Integration Tag ${randomUUID()}`,
				mixcloud_key: "/genres/original/",
				mixcloud_url: "https://example.test/original",
			},
		});
		expect(response.status()).toBe(201);
		await use(await response.json());
	},
	linked: async ({ request, tag }, use) => {
		const djResponse = await request.post("/api/admin/create-dj", {
			multipart: {
				title: `Tag DJ ${randomUUID()}`,
				bio: "Tag editor fixture",
				tags: tag.title,
			},
		});
		expect(djResponse.status()).toBe(201);
		const dj = await djResponse.json();
		const showResponse = await request.post("/api/admin/create-show", {
			data: {
				title: `Tag Show ${randomUUID()}`,
				date: "2026-09-01",
				duration: 3600,
				url: "https://example.test/show",
				djs: [dj.id],
				tags: [tag.title],
			},
		});
		expect(showResponse.status()).toBe(201);
		const show = await showResponse.json();
		await use({ dj: dj.id, show: show.id });
	},
});
test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});
test.beforeEach(async ({ page, tag }) => {
	await page.goto("/admin/#tags");
	await expect(row(page, "Tags", tag.id)).toBeVisible();
});

for (const [field, value] of [
	["title", "Edited"],
	["color", "#AbC123"],
	["mixcloud-key", "/genres/edited/"],
	["mixcloud-url", "https://example.test/edited"],
] as const) {
	test(`prefills and persists ${field} through reload and reopening`, async ({
		page,
		request,
		tag,
	}) => {
		const form = await open(page, tag.id);
		for (const [name, original] of [
			["title", tag.title],
			["color", tag.color],
			["mixcloud-key", tag.mixcloud_key],
			["mixcloud-url", tag.mixcloud_url],
		])
			await expect(page.locator(`#edit-tag-${name}`)).toHaveValue(
				original ?? "",
			);
		await expect(
			form.getByText("Saving marks this tag reviewed"),
		).toBeVisible();
		const next = field === "title" ? `${value} ${randomUUID()}` : value;
		await page.locator(`#edit-tag-${field}`).fill(next);
		await save(page);
		const key = field.replaceAll("-", "_");
		expect(await loadTag(request, tag.id)).toEqual({
			...tag,
			[key]: next,
			reviewed: true,
		});
		await page.reload();
		await open(page, tag.id);
		await expect(page.locator(`#edit-tag-${field}`)).toHaveValue(next);
	});
}
test("previews valid colors, clears metadata, and reviews unchanged saves", async ({
	page,
	request,
	tag,
}) => {
	const form = await open(page, tag.id);
	await page.locator("#edit-tag-color").fill("#112233");
	await page.locator("#edit-tag-title").fill("Preview");
	await expect(
		form.getByRole("status", { name: "Tag color preview" }),
	).toHaveText("Preview");
	await expect(form.getByRole("status").locator("span")).toHaveCSS(
		"background-color",
		"rgb(17, 34, 51)",
	);
	await page.locator("#edit-tag-color").fill("#fff");
	await expect(form.getByRole("status")).toHaveText(
		"Enter a valid hex color to preview",
	);
	await page.locator("#edit-tag-color").fill(tag.color);
	await page.locator("#edit-tag-title").fill(tag.title);
	await save(page);
	expect((await loadTag(request, tag.id)).reviewed).toBe(true);
	await open(page, tag.id);
	await page.locator("#edit-tag-mixcloud-key").fill("");
	await page.locator("#edit-tag-mixcloud-url").fill("");
	await save(page);
	expect(await loadTag(request, tag.id)).toEqual({
		id: tag.id,
		title: tag.title,
		color: tag.color,
		reviewed: true,
	});
	await page.reload();
	await open(page, tag.id);
	await expect(page.locator("#edit-tag-mixcloud-key")).toHaveValue("");
	await expect(page.locator("#edit-tag-mixcloud-url")).toHaveValue("");
});
test("rejects invalid fields locally and retains duplicate-title drafts after server rejection", async ({
	page,
	request,
	tag,
}) => {
	let calls = 0;
	page.on("request", (r) => {
		if (r.url().endsWith("/api/admin/modify-tag")) calls++;
	});
	const form = await open(page, tag.id);
	for (const [field, bad, good] of [
		["title", " ", tag.title],
		["color", "#fff", tag.color],
		["mixcloud-url", "ftp://example.test", tag.mixcloud_url ?? ""],
		["mixcloud-url", "relative", tag.mixcloud_url ?? ""],
	]) {
		await page.locator(`#edit-tag-${field}`).fill(bad);
		await form.getByRole("button", { name: "Save", exact: true }).click();
		await expect(form.getByRole("alert")).toBeVisible();
		await page.locator(`#edit-tag-${field}`).fill(good);
	}
	expect(calls).toBe(0);
	expect(await loadTag(request, tag.id)).toEqual(tag);
	const duplicate = `Duplicate ${randomUUID()}`;
	expect(
		(
			await request.post("/api/admin/create-tag", {
				data: { title: duplicate },
			})
		).status(),
	).toBe(201);
	await page.locator("#edit-tag-title").fill(` ${duplicate.toUpperCase()} `);
	await form.getByRole("button", { name: "Save", exact: true }).click();
	await expect(form.getByRole("alert")).toContainText(
		"Choose a different title",
	);
	await expect(page.locator("#edit-tag-title")).toHaveValue(
		` ${duplicate.toUpperCase()} `,
	);
	expect(await loadTag(request, tag.id)).toEqual(tag);
});
test("all dismissal paths protect dirty values, restore focus, discard, revert, and reopen cleanly", async ({
	page,
	request,
	tag,
}) => {
	for (const dismiss of ["Cancel", "Close", "Escape", "backdrop"]) {
		const form = await open(page, tag.id);
		await page.locator("#edit-tag-title").fill("Unsaved");
		if (dismiss === "Escape")
			await page.locator("#edit-tag-title").press("Escape");
		else if (dismiss === "backdrop")
			await page
				.getByRole("button", { name: "Cancel form", exact: true })
				.click({ position: { x: 2, y: 2 } });
		else await form.getByRole("button", { name: dismiss, exact: true }).click();
		const confirmation = page.getByRole("alertdialog");
		await expect(
			confirmation.getByRole("button", { name: "Keep editing" }),
		).toBeFocused();
		await confirmation.getByRole("button", { name: "Keep editing" }).click();
		await expect(page.locator("#edit-tag-title")).toHaveValue("Unsaved");
		await page.locator("#edit-tag-title").fill(tag.title);
		await form.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(form).toBeHidden();
		await expect(
			row(page, "Tags", tag.id).getByRole("button", { name: "Edit" }),
		).toBeFocused();
	}
	let form = await open(page, tag.id);
	await page.locator("#edit-tag-mixcloud-key").fill("draft");
	await form.getByRole("button", { name: "Close", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(page.locator("#edit-tag-mixcloud-key")).toHaveValue("draft");
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await page
		.getByRole("button", { name: "Discard changes", exact: true })
		.click();
	form = await open(page, tag.id);
	await expect(page.locator("#edit-tag-mixcloud-key")).toHaveValue(
		tag.mixcloud_key ?? "",
	);
	await form.getByRole("button", { name: "Close", exact: true }).click();
	await expect(form).toBeHidden();
	expect(await loadTag(request, tag.id)).toEqual(tag);
});
test("failed saves retain values; pending saves block dismissal and duplicate submission", async ({
	page,
	request,
	tag,
}) => {
	let release: (() => void) | undefined;
	let calls = 0;
	await page.route("**/api/admin/modify-tag", async (route) => {
		calls++;
		if (calls === 1)
			return route.fulfill({
				status: 500,
				contentType: "application/json",
				body: '{"error":"Internal Server Error"}',
			});
		await new Promise<void>((resolve) => {
			release = resolve;
		});
		await route.continue();
	});
	const form = await open(page, tag.id);
	const title = `Retained ${randomUUID()}`;
	await page.locator("#edit-tag-title").fill(title);
	await form.getByRole("button", { name: "Save", exact: true }).click();
	await expect(form.getByRole("alert")).toContainText("Tag could not be saved");
	await expect(page.locator("#edit-tag-title")).toHaveValue(title);
	expect(await loadTag(request, tag.id)).toEqual(tag);
	await form.getByRole("button", { name: "Save", exact: true }).click();
	await expect(form.getByRole("button", { name: "Saving…" })).toBeDisabled();
	for (const name of ["Close", "Cancel"])
		await expect(
			form.getByRole("button", { name, exact: true }),
		).toBeDisabled();
	await expect(
		page.getByRole("button", { name: "Cancel form" }),
	).toBeDisabled();
	await expect(page.locator("#edit-tag-title")).toBeDisabled();
	await page.keyboard.press("Escape");
	await form
		.locator("form")
		.evaluate((node) =>
			node.dispatchEvent(
				new Event("submit", { bubbles: true, cancelable: true }),
			),
		);
	expect(calls).toBe(2);
	await expect(form).toBeVisible();
	await expect.poll(() => release !== undefined).toBe(true);
	release?.();
	await expect(form).toBeHidden();
	await expect(page.getByRole("alertdialog")).toBeHidden();
	expect((await loadTag(request, tag.id)).title).toBe(title);
});
test("returning to linked DJ and Show views reloads the updated chip", async ({
	page,
	tag,
	linked,
}) => {
	await open(page, tag.id);
	const title = `Linked ${randomUUID()}`;
	await page.locator("#edit-tag-title").fill(title);
	await page.locator("#edit-tag-color").fill("#112233");
	await save(page);
	for (const [resource, id] of [
		["DJs", linked.dj],
		["Shows", linked.show],
	] as const) {
		await page.locator(`a[href="#${resource.toLowerCase()}"]`).click();
		await page.getByRole("button", { name: "table", exact: true }).click();
		await row(page, resource, id)
			.getByRole("button", { name: "Edit", exact: true })
			.click();
		const form = page.getByRole("dialog", {
			name: `Edit ${resource === "DJs" ? "DJ" : "Show"}`,
			exact: true,
		});
		const chip = form.getByRole("button", {
			name: `Remove ${title}`,
			exact: true,
		});
		await expect(chip).toBeVisible();
		await expect(chip.locator("..")).toHaveCSS(
			"background-color",
			"rgb(17, 34, 51)",
		);
		await form.getByRole("button", { name: "Cancel", exact: true }).click();
	}
});
for (const width of [390, 320])
	test(`fits ${width}px with reachable actions and trapped focus`, async ({
		page,
		tag,
	}) => {
		await page.setViewportSize({ width, height: 844 });
		const form = await open(page, tag.id);
		await expect
			.poll(() => form.evaluate((node) => node.scrollWidth <= node.clientWidth))
			.toBe(true);
		const cancel = form.getByRole("button", { name: "Cancel", exact: true });
		await cancel.focus();
		await page.keyboard.press("Tab");
		await expect(
			form.getByRole("button", { name: "Close", exact: true }),
		).toBeFocused();
		await page.keyboard.press("Shift+Tab");
		await expect(cancel).toBeFocused();
		await form
			.getByRole("button", { name: "Save", exact: true })
			.scrollIntoViewIfNeeded();
		await expect(
			form.getByRole("button", { name: "Save", exact: true }),
		).toBeInViewport();
		await cancel.click();
		await expect(form).toBeHidden();
	});
