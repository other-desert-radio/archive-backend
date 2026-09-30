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
const test = base.extend<{ tag: Tag }>({
	tag: async ({ request }, use) => {
		const response = await request.post("/api/admin/create-tag", {
			data: {
				title: `Review Tag ${randomUUID()}`,
				mixcloud_key: "/genres/original/",
				mixcloud_url: "https://example.test/original",
			},
		});
		expect(response.status()).toBe(201);
		await use(await response.json());
	},
});
test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});
const row = (page: Page, id: number) =>
	page
		.getByRole("table", { name: "Tags", exact: true })
		.getByRole("row")
		.filter({
			has: page
				.locator("td:nth-child(2)")
				.filter({ hasText: new RegExp(`^${id}$`) }),
		});
const cell = (page: Page, id: number) => row(page, id).getByRole("cell").nth(4);
const load = async (request: APIRequestContext, id: number): Promise<Tag> => {
	const response = await request.get("/api/admin/tags");
	expect(response.ok()).toBeTruthy();
	return (await response.json()).find((tag: Tag) => tag.id === id);
};
const open = async (page: Page, tag: Tag) => {
	const review = cell(page, tag.id);
	const before = await review.boundingBox();
	await review
		.getByRole("button", { name: `Review tag ${tag.title}`, exact: true })
		.click();
	await expect(review.getByText("reviewed?", { exact: true })).toBeVisible();
	const after = await review.boundingBox();
	const block = await review.locator("div[aria-busy]").boundingBox();
	expect(
		Math.abs(
			(block?.x ?? 0) +
				(block?.width ?? 0) / 2 -
				((after?.x ?? 0) + (after?.width ?? 0) / 2),
		),
	).toBeLessThan(1);

	expect(Math.abs((after?.width ?? 0) - (before?.width ?? 0))).toBeLessThan(1);
	return review;
};
const mark = async (page: Page, tag: Tag, reviewed: boolean) => {
	const response = page.waitForResponse(
		(r) =>
			r.url().endsWith("/api/admin/modify-tag") &&
			r.request().method() === "POST",
	);
	await cell(page, tag.id)
		.getByRole("button", {
			name: `Mark ${tag.title} ${reviewed ? "reviewed" : "unreviewed"}`,
			exact: true,
		})
		.click();
	const saved = await response;
	expect(saved.status(), await saved.text()).toBe(200);
	expect(saved.request().postDataJSON()).toEqual({
		edit_type: "review",
		id: tag.id,
		reviewed,
	});
	await expect(
		cell(page, tag.id).getByRole("button", {
			name: `Review tag ${tag.title}`,
			exact: true,
		}),
	).toBeVisible();
};
test.beforeEach(async ({ page, tag }) => {
	await page.goto("/admin/#tags");
	await expect(row(page, tag.id)).toBeVisible();
});

test("Review asks reviewed?; check and cross save true and false without changing metadata", async ({
	page,
	request,
	tag,
}) => {
	let calls = 0;
	page.on("request", (r) => {
		if (r.url().endsWith("/api/admin/modify-tag")) calls++;
	});
	await expect(
		cell(page, tag.id).getByText("false", { exact: true }),
	).toBeVisible();
	const review = await open(page, tag);
	const yes = review.getByRole("button", {
		name: `Mark ${tag.title} reviewed`,
		exact: true,
	});
	const no = review.getByRole("button", {
		name: `Mark ${tag.title} unreviewed`,
		exact: true,
	});
	await expect(yes).toBeFocused();
	const yesBox = await yes.boundingBox();
	const noBox = await no.boundingBox();
	expect(yesBox?.height).toBe(noBox?.height);
	expect(yesBox?.height).toBe(28);
	expect(calls).toBe(0);
	expect(await load(request, tag.id)).toEqual(tag);
	for (const reviewed of [true, false, false]) {
		if (calls > 0) await open(page, tag);
		await mark(page, tag, reviewed);
		expect(await load(request, tag.id)).toEqual({ ...tag, reviewed });
		await expect(
			cell(page, tag.id).getByText(String(reviewed), { exact: true }),
		).toBeVisible();
		const reviewButton = cell(page, tag.id).getByRole("button", {
			name: `Review tag ${tag.title}`,
			exact: true,
		});
		await expect(reviewButton).toHaveCSS(
			"border-top-style",
			reviewed ? "dashed" : "solid",
		);
		await expect(reviewButton).toHaveCSS(
			"background-color",
			reviewed ? "rgba(0, 0, 0, 0)" : "rgb(255, 255, 255)",
		);

		await expect(
			cell(page, tag.id).getByRole("button", {
				name: `Review tag ${tag.title}`,
				exact: true,
			}),
		).toBeFocused();
	}
	await page.reload();
	await expect(
		cell(page, tag.id).getByText("false", { exact: true }),
	).toBeVisible();
	expect(calls).toBe(3);
	// The existing full editor continues to mark metadata saves reviewed.
	await row(page, tag.id)
		.getByRole("button", { name: "Edit", exact: true })
		.click();
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Edit Tag" })).toBeHidden();
	expect((await load(request, tag.id)).reviewed).toBe(true);
});
test("Escape dismisses either action without mutation, and keyboard review works", async ({
	page,
	request,
	tag,
}) => {
	for (const action of ["reviewed", "unreviewed"]) {
		const review = await open(page, tag);
		const button = review.getByRole("button", {
			name: `Mark ${tag.title} ${action}`,
			exact: true,
		});
		await button.focus();
		await button.press("Escape");
		await expect(
			review.getByRole("button", { name: `Review tag ${tag.title}` }),
		).toBeFocused();
		expect(await load(request, tag.id)).toEqual(tag);
	}
	const review = await open(page, tag);
	const response = page.waitForResponse((r) =>
		r.url().endsWith("/api/admin/modify-tag"),
	);
	await review
		.getByRole("button", { name: `Mark ${tag.title} reviewed`, exact: true })
		.press("Enter");
	expect((await response).status()).toBe(200);
	expect((await load(request, tag.id)).reviewed).toBe(true);
});
test("failed answers retain the prompt and pending answers block duplicate submissions", async ({
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
	const review = await open(page, tag);
	const yes = review.getByRole("button", {
		name: `Mark ${tag.title} reviewed`,
		exact: true,
	});
	const no = review.getByRole("button", {
		name: `Mark ${tag.title} unreviewed`,
		exact: true,
	});
	await yes.click();
	await expect(review.getByRole("alert")).toContainText(
		"Tag could not be saved",
	);
	await expect(review.getByText("reviewed?", { exact: true })).toBeVisible();
	expect(await load(request, tag.id)).toEqual(tag);
	await no.click();
	await expect(yes).toBeDisabled();
	await expect(no).toBeDisabled();
	await page.keyboard.press("Escape");
	await yes.evaluate((button) => (button as HTMLButtonElement).click());
	expect(calls).toBe(2);
	await expect(review.getByText("reviewed?", { exact: true })).toBeVisible();
	await expect.poll(() => release !== undefined).toBe(true);
	release?.();
	await expect(
		review.getByRole("button", { name: `Review tag ${tag.title}` }),
	).toBeVisible();
	expect(await load(request, tag.id)).toEqual(tag);
});
for (const width of [390, 320])
	test(`review actions are reachable and equal-height at ${width}px`, async ({
		page,
		request,
		tag,
	}) => {
		await page.setViewportSize({ width, height: 844 });
		const review = await open(page, tag);
		const yes = review.getByRole("button", {
			name: `Mark ${tag.title} reviewed`,
			exact: true,
		});
		const no = review.getByRole("button", {
			name: `Mark ${tag.title} unreviewed`,
			exact: true,
		});
		await no.scrollIntoViewIfNeeded();
		await expect(yes).toBeInViewport();
		await expect(no).toBeInViewport();
		expect((await yes.boundingBox())?.height).toBe(
			(await no.boundingBox())?.height,
		);
		await mark(page, tag, true);
		expect((await load(request, tag.id)).reviewed).toBe(true);
	});
