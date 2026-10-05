import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { createDJ, loadDJ } from "./dj-fixtures.js";
import {
	loadShow,
	openShowEditor,
	saveShow,
	showRow,
	test,
} from "./show-fixtures.js";

test.use({ timezoneId: "America/Los_Angeles" });
test.beforeEach(async ({ page, show }) => {
	await page.goto("/admin/#shows");
	await page.getByRole("button", { name: "table", exact: true }).click();
	await expect(showRow(page, show.id)).toBeVisible();
});

for (const [field, value] of [
	["title", "Changed title"],
	["date", "2025-01-02"],
	["duration", "7201"],
	["image_small", "https://example.test/replacement-small.jpg"],
	["image_large", "https://example.test/replacement.jpg"],
	["url", "https://example.test/replacement"],
] as const) {
	test(`edits ${field} and persists through reload and reopening`, async ({
		page,
		request,
		show,
	}) => {
		await openShowEditor(page, show.id);
		await expect(page.locator("#edit-show-date")).toHaveValue("2024-02-29");
		await expect(page.locator("#edit-show-duration")).toHaveValue("3661");
		await page.locator(`#edit-show-${field.replaceAll("_", "-")}`).fill(value);
		await saveShow(page);
		const expected = {
			...show,
			[field]:
				field === "date"
					? `${value}T00:00:00.000Z`
					: field === "duration"
						? Number(value)
						: value,
		};
		if (field === "image_large") expected.image = value;
		expect(await loadShow(request, show.id)).toEqual(expected);
		await page.reload();
		await expect(showRow(page, show.id)).toBeVisible();
		await openShowEditor(page, show.id);
		await expect(
			page.locator(`#edit-show-${field.replaceAll("_", "-")}`),
		).toHaveValue(value);
	});
}

test("opens from grid and requires both image URLs while retaining drafts", async ({
	page,
	request,
	show,
}) => {
	await page.getByRole("button", { name: "grid", exact: true }).click();
	await page
		.getByRole("button", { name: `Edit ${show.title}`, exact: true })
		.click();
	for (const size of ["small", "large"]) {
		const input = page.locator(`#edit-show-image-${size}`);
		await expect(input).toHaveValue(
			show[`image_${size}` as "image_small" | "image_large"],
		);
		await input.fill("");
		await page.getByRole("button", { name: "Save", exact: true }).click();
		expect(
			await input.evaluate(
				(input: HTMLInputElement) => input.validity.valueMissing,
			),
		).toBe(true);
		expect(await loadShow(request, show.id)).toEqual(show);
		await input.fill(`https://example.test/changed-${size}.jpg`);
	}
	await saveShow(page);
	const saved = await loadShow(request, show.id);
	expect(saved.image_small).toBe("https://example.test/changed-small.jpg");
	expect(saved.image_large).toBe("https://example.test/changed-large.jpg");
	expect(saved.image).toBe(saved.image_large);
});

test("replaces DJ links, persists inverse links, and requires a DJ", async ({
	page,
	request,
	show,
	dj,
}) => {
	const replacement = await createDJ(request, false);
	const form = await openShowEditor(page, show.id);
	const original = form.getByRole("checkbox", {
		name: `${dj.title} (#${dj.id})`,
		exact: true,
	});
	await expect(original).toBeChecked();
	await form
		.getByRole("searchbox", { name: "Search DJs" })
		.fill(replacement.title);
	await form
		.getByRole("checkbox", {
			name: `${replacement.title} (#${replacement.id})`,
			exact: true,
		})
		.check();
	await form
		.getByRole("button", {
			name: `Remove ${dj.title} (#${dj.id})`,
			exact: true,
		})
		.click();
	await saveShow(page);
	expect((await loadShow(request, show.id)).djs).toEqual([replacement.id]);
	expect((await loadDJ(request, dj.id)).shows).not.toContain(show.id);
	expect((await loadDJ(request, replacement.id)).shows).toContain(show.id);
	await page.reload();
	const reopened = await openShowEditor(page, show.id);
	await expect(
		reopened.getByRole("checkbox", {
			name: `${replacement.title} (#${replacement.id})`,
			exact: true,
		}),
	).toBeChecked();
	await reopened
		.getByRole("button", {
			name: `Remove ${replacement.title} (#${replacement.id})`,
			exact: true,
		})
		.click();
	await reopened.getByRole("button", { name: "Save", exact: true }).click();
	await expect(reopened.getByRole("alert")).toContainText(
		"Select at least one DJ",
	);
	expect((await loadShow(request, show.id)).djs).toEqual([replacement.id]);
});

test("adds existing and focused draft tags, removes tags, and clears all assignments", async ({
	page,
	request,
	show,
}) => {
	const existing = `Existing ${randomUUID()}`;
	const response = await request.post("/api/admin/create-tag", {
		data: { title: existing, color: "#123456" },
	});
	expect(response.status()).toBe(201);
	const existingTag = await response.json();
	const form = await openShowEditor(page, show.id);
	await expect(
		form.getByRole("button", { name: `Remove ${show.title}`, exact: true }),
	).toBeVisible();
	await page.locator("#edit-show-tags").fill(existing);
	await form.getByRole("option", { name: existing, exact: true }).click();
	const draft = `Draft ${randomUUID()}`;
	await page.locator("#edit-show-tags").fill(draft);
	await saveShow(page);
	const saved = await loadShow(request, show.id);
	expect(saved.tags).toHaveLength(3);
	expect(saved.tags).toContain(existingTag.id);
	await page.reload();
	const reopened = await openShowEditor(page, show.id);
	await reopened
		.getByRole("button", { name: `Remove ${show.title}`, exact: true })
		.click();
	await reopened
		.getByRole("button", { name: `Remove ${existing}`, exact: true })
		.click();
	await reopened
		.getByRole("button", { name: `Remove ${draft}`, exact: true })
		.click();
	await saveShow(page);
	expect((await loadShow(request, show.id)).tags).toEqual([]);
});

for (const [field, value] of [
	["title", ""],
	["title", " "],
	["duration", "0"],
	["duration", "1.5"],
	["duration", "2147483648"],
	["date", ""],
	["url", "relative"],
	["image-small", "relative"],
	["image-large", "relative"],
	["image-small", ""],
	["image-large", ""],
] as const) {
	test(`rejects invalid ${field}: ${JSON.stringify(value)}`, async ({
		page,
		request,
		show,
	}) => {
		const form = await openShowEditor(page, show.id);
		await page.locator(`#edit-show-${field.replaceAll("_", "-")}`).fill(value);
		await form.getByRole("button", { name: "Save", exact: true }).click();
		await expect(form).toBeVisible();
		expect(await loadShow(request, show.id)).toEqual(show);
	});
}

test("discard paths preserve drafts and focus, reversion closes cleanly, and reopening resets", async ({
	page,
	request,
	show,
}) => {
	let form = await openShowEditor(page, show.id);
	for (const dismiss of ["Cancel", "Close", "Escape", "backdrop"]) {
		await page.locator("#edit-show-title").fill("Unsaved");
		if (dismiss === "Escape")
			await page.locator("#edit-show-title").press("Escape");
		else if (dismiss === "backdrop")
			await page
				.getByRole("button", { name: "Cancel form", exact: true })
				.click({ position: { x: 2, y: 2 } });
		else await form.getByRole("button", { name: dismiss, exact: true }).click();
		const confirmation = page.getByRole("alertdialog");
		await expect(
			confirmation.getByRole("button", { name: "Keep editing" }),
		).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(page.locator("#edit-show-title")).toHaveValue("Unsaved");
	}
	await page.locator("#edit-show-title").fill(show.title);
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(form).toBeHidden();
	form = await openShowEditor(page, show.id);
	await page.locator("#edit-show-tags").fill("Unsaved tag");
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await page
		.getByRole("button", { name: "Discard changes", exact: true })
		.click();
	expect(await loadShow(request, show.id)).toEqual(show);
	form = await openShowEditor(page, show.id);
	await expect(page.locator("#edit-show-title")).toHaveValue(show.title);
	await expect(page.locator("#edit-show-tags")).toHaveValue("");
});

test("failed saves retain values and pending saves block dismissal and duplicate submission", async ({
	page,
	request,
	show,
}) => {
	let release: (() => void) | undefined;
	let calls = 0;
	await page.route("**/api/admin/modify-show", async (route) => {
		calls += 1;
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
	const form = await openShowEditor(page, show.id);
	await page.locator("#edit-show-title").fill("Retained title");
	await form.getByRole("button", { name: "Save", exact: true }).click();
	await expect(form.getByRole("alert")).toContainText(
		"Show could not be saved",
	);
	await expect(page.locator("#edit-show-title")).toHaveValue("Retained title");
	expect(await loadShow(request, show.id)).toEqual(show);
	await form.getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		form.getByRole("button", { name: "Saving…", exact: true }),
	).toBeDisabled();
	await expect(
		form.getByRole("button", { name: "Close", exact: true }),
	).toBeDisabled();
	await page.keyboard.press("Escape");
	await expect(form).toBeVisible();
	expect(calls).toBe(2);
	await expect.poll(() => release !== undefined).toBe(true);
	release?.();
	await expect(form).toBeHidden();
	await expect(page.getByRole("alertdialog")).toBeHidden();
	expect((await loadShow(request, show.id)).title).toBe("Retained title");
});

test("unresolved assigned tags block saving, retry resolves them without resetting edits", async ({
	page,
	show,
}) => {
	await page.route("**/api/admin/tags", async (route) => {
		const response = await route.fetch();
		const tags = await response.json();
		await route.fulfill({
			response,
			json: tags.filter((tag: { id: number }) => !show.tags.includes(tag.id)),
		});
	});
	await page.reload();
	const form = await openShowEditor(page, show.id);
	await expect(
		form.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	await page.locator("#edit-show-title").fill("Preserved draft");
	await page.locator("#edit-show-tags").fill("Typed during loading");
	await expect(
		form.getByText("Some assigned tags could not be loaded.", { exact: false }),
	).toBeVisible();
	await page.unroute("**/api/admin/tags");
	await form.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(
		form.getByRole("button", { name: "Save", exact: true }),
	).toBeEnabled();
	await expect(page.locator("#edit-show-title")).toHaveValue("Preserved draft");
	// Blur commits the tag draft before retry; its selection must still be present.
	await expect(
		form.getByRole("button", {
			name: "Remove Typed during loading",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		form.getByRole("button", { name: `Remove ${show.title}`, exact: true }),
	).toBeVisible();
});

for (const width of [390, 320]) {
	test(`editor fits ${width}px and keeps actions reachable`, async ({
		page,
		show,
	}) => {
		await page.setViewportSize({ width, height: 844 });
		const form = await openShowEditor(page, show.id);
		await expect
			.poll(async () =>
				form.evaluate((node) => node.scrollWidth <= node.clientWidth),
			)
			.toBe(true);
		await form
			.getByRole("button", { name: "Save", exact: true })
			.scrollIntoViewIfNeeded();
		await expect(
			form.getByRole("button", { name: "Save", exact: true }),
		).toBeInViewport();
		await form.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(form).toBeHidden();
	});
}
