import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";

test.use({ baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001" });
const cover = await sharp({
	create: { width: 400, height: 400, channels: 3, background: "#c98b56" },
})
	.png()
	.toBuffer();
const editorial = {
	title: "Our show",
	description: "Our description",
	date: "2026-10-26",
	djs: [1],
};
const mixcloud = {
	key: "/odr/show/",
	url: "https://www.mixcloud.com/odr/show/",
	name: "DJ - Provider title",
	tags: [
		{
			key: "/genres/house/",
			name: "House",
			url: "https://www.mixcloud.com/genres/house/",
		},
	],
	created_time: "2026-10-26T12:00:00Z",
	updated_time: "2026-10-26T12:00:00Z",
	play_count: 0,
	pictures: {
		large: "https://images.test/small.jpg",
		"1024wx1024h": "https://images.test/large.jpg",
	},
	slug: "show",
	audio_length: 120,
};
const saved = {
	id: 42,
	createdAt: "2026-10-26T12:00:00Z",
	date: "2026-10-25T00:00:00Z",
	title: "Persisted show title",
	description: "Persisted description\nSecond line",
	duration: 120,
	image: mixcloud.pictures["1024wx1024h"],
	mixcloud_image_small: mixcloud.pictures.large,
	mixcloud_image_large: mixcloud.pictures["1024wx1024h"],
	url: mixcloud.url,
	djs: [2],
	tags: [3],
};

async function setup(
	page: Page,
	options: {
		prepareFailures?: number;
		saveFailures?: number;
		reloadFails?: boolean;
		holdPrepare?: boolean;
		holdSave?: boolean;
		uploadFails?: boolean;
	} = {},
) {
	const calls = { uploads: 0, prepares: 0, saves: [] as unknown[], manual: 0 };
	let committed = false;
	let releasePrepare = () => {};
	let releaseSave = () => {};
	const prepareGate = options.holdPrepare
		? new Promise<void>((resolve) => {
				releasePrepare = resolve;
			})
		: Promise.resolve();
	const saveGate = options.holdSave
		? new Promise<void>((resolve) => {
				releaseSave = resolve;
			})
		: Promise.resolve();
	await page.route("https://images.test/**", (route) =>
		route.fulfill({ contentType: "image/png", body: cover }),
	);
	await page.route("**/api/**", async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path === "/api/auth/get-session")
			return route.fulfill({
				json: {
					user: {
						id: "editor",
						email: "editor@example.test",
						role: "editor",
						mustChangePassword: false,
					},
				},
			});
		if (path === "/api/admin/shows")
			return committed && options.reloadFails
				? route.fulfill({ status: 500, json: { error: "Unavailable" } })
				: route.fulfill({ json: committed ? [saved] : [] });
		if (path === "/api/admin/djs")
			return route.fulfill({
				json: [
					{ id: 1, title: "Original DJ", tags: [], shows: [] },
					{ id: 2, title: "Guest DJ", tags: [], shows: [] },
				],
			});
		if (path === "/api/admin/tags")
			return route.fulfill({
				json: [
					{
						id: 3,
						title: "House",
						color: "#cc3300",
						reviewed: true,
						shows: [],
					},
				],
			});
		if (path === "/api/admin/mixcloud/status")
			return route.fulfill({
				json: {
					configured: true,
					connected: true,
					account: { key: "/odr/", displayName: "ODR" },
				},
			});
		if (path === "/api/admin/mixcloud/upload") {
			calls.uploads++;
			expect(route.request().postDataBuffer()?.toString()).toContain(
				'name="djs"',
			);
			return options.uploadFails
				? route.fulfill({ status: 502, json: { success: false } })
				: route.fulfill({
						json: {
							success: true,
							uploadId: 5,
							key: mixcloud.key,
							url: mixcloud.url,
						},
					});
		}
		if (path === "/api/admin/mixcloud/uploads/5/prepare") {
			calls.prepares++;
			await prepareGate;
			return calls.prepares <= (options.prepareFailures ?? 0)
				? route.fulfill({
						status: 502,
						json: { error: "Mixcloud details are not ready" },
					})
				: route.fulfill({ json: { uploadId: 5, editorial, mixcloud } });
		}
		if (path === "/api/admin/mixcloud/uploads/5/save") {
			calls.saves.push(route.request().postDataJSON());
			await saveGate;
			if (calls.saves.length <= (options.saveFailures ?? 0))
				return route.fulfill({
					status: 500,
					json: { error: "Database unavailable" },
				});
			committed = true;
			return route.fulfill({ status: 201, json: { show: saved } });
		}
		if (path === "/api/admin/create-show") {
			calls.manual++;
			return route.fulfill({ status: 201, json: saved });
		}
		return route.fulfill({
			status: 404,
			json: { error: "Unexpected test request" },
		});
	});
	await page.goto("/admin/#shows");
	return {
		calls,
		releasePrepare: () => releasePrepare(),
		releaseSave: () => releaseSave(),
	};
}

async function upload(page: Page) {
	await page.getByRole("button", { name: "+ show", exact: true }).click();
	const form = page.getByRole("dialog", { name: "Upload Show", exact: true });
	await form
		.getByRole("textbox", { name: "title", exact: true })
		.fill(editorial.title);
	await form.getByLabel("date", { exact: true }).fill(editorial.date);
	await form
		.getByLabel("description", { exact: true })
		.fill(editorial.description);
	await form.getByRole("combobox", { name: "Search DJs" }).fill("Original");
	await form.getByRole("option", { name: "Original DJ", exact: true }).click();
	await form.locator("#show-mp3").setInputFiles({
		name: "show.mp3",
		mimeType: "audio/mpeg",
		buffer: Buffer.from("mock-audio"),
	});
	await form
		.locator("#show-image")
		.setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: cover });
	await page.getByRole("button", { name: "Use image", exact: true }).click();
	await form.locator('button[type="submit"]').click();
}

for (const width of [1280, 390, 320])
	test(`upload → review → persisted success at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		const state = await setup(page, { holdPrepare: true, holdSave: true });
		await upload(page);
		await expect(
			page.getByRole("dialog", { name: "Uploaded to Mixcloud", exact: true }),
		).toBeVisible();
		state.releasePrepare();
		const review = page.getByRole("dialog", {
			name: "Review Show",
			exact: true,
		});
		await expect(review).toBeVisible();
		await expect(
			review.getByRole("textbox", { name: "title", exact: true }),
		).toHaveValue(editorial.title);
		await expect(
			review.getByRole("textbox", { name: "description", exact: true }),
		).toHaveValue(editorial.description);
		await expect(
			review.getByRole("button", { name: "Save Show", exact: true }),
		).toBeEnabled();
		await expect(
			review.getByRole("textbox", { name: "show URL", exact: true }),
		).toHaveCount(0);
		await expect(review.getByText("00:02:00", { exact: true })).toBeVisible();
		await expect(page.locator("[inert]").first()).toBeAttached();
		await expect
			.poll(() => review.evaluate((el) => el.contains(document.activeElement)))
			.toBe(true);
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({ path: `/tmp/upload-review-${width}.png` });
		await review
			.getByRole("textbox", { name: "title", exact: true })
			.fill("Reviewed title");
		await review
			.getByRole("textbox", { name: "description", exact: true })
			.fill("Reviewed description");
		await review.getByLabel("date", { exact: true }).fill("2026-10-25");
		await review
			.getByRole("button", { name: "Remove Original DJ", exact: true })
			.click();
		await review.getByRole("combobox", { name: "Search DJs" }).fill("Guest");
		await review.getByRole("option", { name: "Guest DJ", exact: true }).click();
		await review
			.getByRole("button", { name: "Save Show", exact: true })
			.click();
		await expect(
			review.getByRole("button", { name: "Saving…", exact: true }),
		).toBeDisabled();
		await page.keyboard.press("Escape");
		await expect(review).toBeVisible();
		state.releaseSave();
		const success = page.getByRole("dialog", {
			name: "Show saved",
			exact: true,
		});
		await expect(success).toBeVisible();
		await expect(
			success.getByRole("heading", { name: "Show saved", exact: true }),
		).toBeInViewport();
		await expect(success.getByText(saved.title, { exact: true })).toBeVisible();
		await expect(
			success.getByText("Guest DJ (ID 2)", { exact: true }),
		).toBeVisible();
		await expect(
			success.getByText("House (ID 3)", { exact: true }),
		).toBeVisible();
		expect(state.calls.uploads).toBe(1);
		expect(state.calls.saves).toEqual([
			{
				title: "Reviewed title",
				description: "Reviewed description",
				date: "2026-10-25",
				djs: [2],
			},
		]);
		await page.screenshot({ path: `/tmp/upload-saved-${width}.png` });
		await page.keyboard.press("Escape");
		await expect(success).toBeHidden();
		await expect(
			page.getByRole("button", { name: "+ show", exact: true }),
		).toBeFocused();
	});

test("metadata and save retries retain edits without another upload", async ({
	page,
}) => {
	const { calls } = await setup(page, { prepareFailures: 1, saveFailures: 1 });
	await upload(page);
	await page
		.getByRole("button", { name: "Retry loading details", exact: true })
		.click();
	const review = page.getByRole("dialog", {
		name: "Review Show",
		exact: true,
	});
	await review
		.getByRole("textbox", { name: "title", exact: true })
		.fill("Keep my edits");
	await review.getByRole("button", { name: "Save Show", exact: true }).click();
	await expect(review.getByRole("alert")).toContainText("Database unavailable");
	await expect(
		review.getByRole("textbox", { name: "title", exact: true }),
	).toHaveValue("Keep my edits");
	await review.getByRole("button", { name: "Save Show", exact: true }).click();
	await expect(
		page.getByRole("dialog", { name: "Show saved", exact: true }),
	).toBeVisible();
	expect(calls.uploads).toBe(1);
	expect(calls.prepares).toBe(2);
	expect(calls.saves).toHaveLength(2);
});

test("success survives list reload failure with persisted IDs and retry feedback", async ({
	page,
}) => {
	const { calls } = await setup(page, { reloadFails: true });
	await upload(page);
	await page.getByRole("button", { name: "Save Show", exact: true }).click();
	const success = page.getByRole("dialog", { name: "Show saved", exact: true });
	await expect(success).toBeVisible();
	await expect(success.getByText(saved.title, { exact: true })).toBeVisible();
	await success.getByRole("button", { name: "Close", exact: true }).click();
	await expect(
		page.getByText(
			"Show saved, but the latest resource lists could not be loaded.",
		),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Reload lists", exact: true }),
	).toBeVisible();
	expect(calls.saves).toHaveLength(1);
	expect(calls.uploads).toBe(1);
});

test("review dismissal warns and ignores obsolete prepare responses", async ({
	page,
}) => {
	const { calls, releasePrepare } = await setup(page, { holdPrepare: true });
	await upload(page);
	await page
		.getByRole("dialog", { name: "Uploaded to Mixcloud", exact: true })
		.getByRole("button", { name: "Close", exact: true })
		.click();
	releasePrepare();
	await page.getByRole("button", { name: "+ show", exact: true }).click();
	await expect(
		page.getByRole("dialog", { name: "Upload Show", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("dialog", { name: "Review Show", exact: true }),
	).toHaveCount(0);
	expect(calls.uploads).toBe(1);
});

test("review close uses dirty confirmation and keeps edits", async ({
	page,
}) => {
	await setup(page);
	await upload(page);
	const review = page.getByRole("dialog", {
		name: "Review Show",
		exact: true,
	});
	await review
		.getByRole("textbox", { name: "title", exact: true })
		.fill("Keep this");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("alertdialog")).toBeVisible();
	await page.getByRole("button", { name: "Keep editing", exact: true }).click();
	await expect(
		review.getByRole("textbox", { name: "title", exact: true }),
	).toHaveValue("Keep this");
	await review
		.getByRole("button", { name: "Close", exact: true })
		.last()
		.click();
	await page
		.getByRole("button", { name: "Discard changes", exact: true })
		.click();
	await expect(review).toBeHidden();
});

test("rejected uploads retain the original form and do not prepare metadata", async ({
	page,
}) => {
	const { calls } = await setup(page, { uploadFails: true });
	await upload(page);
	const form = page.getByRole("dialog", { name: "Upload Show", exact: true });
	await expect(form.getByRole("alert")).toContainText("Unable to confirm");
	await expect(
		form.getByRole("textbox", { name: "title", exact: true }),
	).toHaveValue(editorial.title);
	expect(calls.prepares).toBe(0);
});
