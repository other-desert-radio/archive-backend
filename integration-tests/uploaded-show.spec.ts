import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";

test.use({ baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001" });
const cover = await sharp({
	create: { width: 400, height: 400, channels: 3, background: "#c98b56" },
})
	.png()
	.toBuffer();
const tracklist = [
	{ artist: "Track artist", song: "Track song", start_time: 30 },
];
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
	tracklist: [],
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
		holdUpload?: boolean;
		uploadFails?: boolean;
		missingTags?: boolean;
		specialOnly?: boolean;
		pending?: boolean;
		pendingFailures?: number;
		removeFailures?: number;
	} = {},
) {
	const savedResponse = options.specialOnly
		? { ...saved, djs: [], special: { id: 7, title: "Festival" } }
		: saved;
	const calls = {
		uploads: 0,
		prepares: 0,
		saves: [] as unknown[],
		manual: 0,
		modifies: 0,
		pendingLoads: 0,
		removes: 0,
	};
	let committed = false;
	let uploaded = options.pending ?? false;
	let releasePrepare = () => {};
	let releaseSave = () => {};
	let releaseUpload = () => {};
	const uploadGate = options.holdUpload
		? new Promise<void>((resolve) => {
				releaseUpload = resolve;
			})
		: Promise.resolve();
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
		if (
			path === "/api/admin/mixcloud/uploads/5" &&
			route.request().method() === "DELETE"
		) {
			calls.removes++;
			if (calls.removes <= (options.removeFailures ?? 0))
				return route.fulfill({ status: 500, json: { error: "Unavailable" } });
			uploaded = false;
			return route.fulfill({ json: { uploadId: 5 } });
		}
		if (path === "/api/admin/mixcloud/uploads/pending") {
			calls.pendingLoads++;
			return calls.pendingLoads <= (options.pendingFailures ?? 0)
				? route.fulfill({ status: 500, json: { error: "Unavailable" } })
				: route.fulfill({
						json:
							uploaded && !committed
								? [
										{
											uploadId: 5,
											key: mixcloud.key,
											url: mixcloud.url,
											title: editorial.title,
											date: editorial.date,
										},
									]
								: [],
					});
		}
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
				: route.fulfill({ json: committed ? [savedResponse] : [] });
		if (path === "/api/admin/djs")
			return route.fulfill({
				json: [
					{ id: 1, title: "Original DJ", tags: [], shows: [] },
					{ id: 2, title: "Guest DJ", tags: [], shows: [] },
				],
			});
		if (path === "/api/admin/specials")
			return route.fulfill({
				json: [{ id: 7, title: "Festival", createdAt: "2026-01-01Z" }],
			});
		if (path === "/api/admin/tags")
			return route.fulfill({
				json: options.missingTags
					? []
					: [
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
			uploaded = !options.uploadFails;
			calls.uploads++;
			expect(route.request().postDataBuffer()?.toString()).toContain(
				JSON.stringify(tracklist),
			);
			await uploadGate;
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
						json: {
							error:
								"Uploaded to Mixcloud, but we were unable to fetch the show.",
						},
					})
				: route.fulfill({
						json: {
							uploadId: 5,
							tracklist,
							editorial: options.specialOnly
								? { ...editorial, djs: [], special_id: 7 }
								: editorial,
							mixcloud,
						},
					});
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
			return route.fulfill({ status: 201, json: { show: savedResponse } });
		}
		if (path === "/api/admin/create-show") {
			calls.manual++;
			committed = true;
			return route.fulfill({ status: 201, json: saved });
		}
		if (path === "/api/admin/modify-show") {
			calls.modifies++;
			expect(route.request().postDataJSON().id).toBe(saved.id);
			return route.fulfill({ json: saved });
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
		releaseUpload: () => releaseUpload(),
	};
}

async function upload(page: Page, specialOnly = false) {
	await page.getByRole("button", { name: "+ show", exact: true }).click();
	const form = page.getByRole("dialog", { name: "Upload Show", exact: true });
	await form
		.getByRole("textbox", { name: "title", exact: true })
		.fill(editorial.title);
	await form.getByLabel("date", { exact: true }).fill(editorial.date);
	await form
		.getByLabel("description", { exact: true })
		.fill(editorial.description);
	if (specialOnly) {
		await form
			.getByRole("combobox", { name: "Search Special", exact: true })
			.fill("Festival");
		await form.getByRole("option", { name: "Festival", exact: true }).click();
		await expect(
			form.getByRole("textbox", { name: "Mixcloud title", exact: true }),
		).toHaveValue("Festival - Our show, October 26, 2026");
		const group = form
			.getByText("Choose archive DJs or a special to save this show.", {
				exact: true,
			})
			.locator("..");
		await expect(
			group.getByRole("combobox", { name: "Search DJs", exact: true }),
		).toBeVisible();
		await expect(
			group.getByRole("combobox", { name: "Search Special", exact: true }),
		).toBeVisible();
	} else {
		await form.getByRole("combobox", { name: "Search DJs" }).fill("Original");
		await form
			.getByRole("option", { name: "Original DJ", exact: true })
			.click();
	}
	await form
		.getByRole("button", { name: "add tracklist", exact: true })
		.click();
	const editor = page.getByRole("dialog", {
		name: "Add tracklist",
		exact: true,
	});
	await editor
		.getByRole("button", { name: "+ Add track", exact: true })
		.click();
	await editor
		.getByRole("textbox", { name: "artist", exact: true })
		.fill("Track artist");
	await editor
		.getByRole("textbox", { name: "song", exact: true })
		.fill("Track song");
	await editor.getByRole("textbox", { name: /timestamp/ }).fill("0:30");
	await editor.getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		form.getByRole("button", { name: "edit tracklist", exact: true }),
	).toBeFocused();

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
		await expect(
			review.locator("section").getByText("tags", { exact: true }),
		).toHaveCount(0);
		await review
			.getByRole("combobox", { name: "tags", exact: true })
			.fill("New review tag");
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
				tracklist,
				date: "2026-10-25",
				djs: [2],
				special_id: null,
				tags: ["House", "New review tag"],
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
	const failure = page.getByRole("dialog", {
		name: "Uploaded to Mixcloud",
		exact: true,
	});
	await expect(failure.getByRole("alert")).toHaveText(
		"Uploaded to Mixcloud, but we were unable to fetch the show.\n\nStatus: HTTP 502 (Bad Gateway)",
	);
	await expect(
		failure.getByRole("link", { name: mixcloud.key, exact: true }),
	).toHaveAttribute("href", mixcloud.url);
	await expect(failure).not.toContainText("Please correct this issue");
	for (const width of [1280, 390, 320]) {
		await page.setViewportSize({ width, height: 900 });
		await page.screenshot({ path: `/tmp/upload-details-error-${width}.png` });
	}
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
	const { calls } = await setup(page, { reloadFails: true, missingTags: true });
	await upload(page);
	await page.getByRole("button", { name: "Save Show", exact: true }).click();
	const success = page.getByRole("dialog", { name: "Show saved", exact: true });
	await expect(success).toBeVisible();
	await expect(success.getByText(saved.title, { exact: true })).toBeVisible();
	await expect(success.getByText("ID 3", { exact: true })).toBeVisible();
	await success.getByRole("button", { name: "Close", exact: true }).click();
	await expect(
		page.getByText(
			"Show changes saved, but the latest resource lists could not be loaded.",
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

test("manual onboarding and editing keep using the existing Show endpoints", async ({
	page,
}) => {
	const { calls } = await setup(page);
	await page.getByRole("button", { name: "+ show", exact: true }).click();
	await page.locator("#show-title").fill("Manual show");
	await page.locator("#show-date").fill("2026-10-26");
	await page.getByRole("combobox", { name: "Search DJs" }).fill("Original");
	await page.getByRole("option", { name: "Original DJ", exact: true }).click();
	await page
		.getByRole("button", { name: "existing show", exact: true })
		.click();
	const form = page.getByRole("dialog", { name: "Onboard Show", exact: true });
	await expect(
		form.getByRole("textbox", { name: "title", exact: true }),
	).toHaveValue("Manual show");
	await page.locator("#show-duration").fill("120");
	await page.locator("#show-image-small").fill(mixcloud.pictures.large);
	await page
		.locator("#show-image-large")
		.fill(mixcloud.pictures["1024wx1024h"]);
	await page.locator("#show-url").fill(mixcloud.url);
	await form.locator('button[type="submit"]').click();
	await expect(form).toBeHidden();
	expect(calls.manual).toBe(1);
	await page.getByRole("button", { name: "Edit", exact: true }).first().click();
	const edit = page.getByRole("dialog", { name: "Edit Show", exact: true });
	await edit
		.getByRole("textbox", { name: "title", exact: true })
		.fill("Changed title");
	await edit.getByRole("button", { name: "Save", exact: true }).click();
	await expect(edit).toBeHidden();
	expect(calls.modifies).toBe(1);
	expect(calls.uploads).toBe(0);
	expect(calls.prepares).toBe(0);
	expect(calls.saves).toHaveLength(0);
});

test("upload submission locks controls until provider confirmation", async ({
	page,
}) => {
	const state = await setup(page, { holdUpload: true });
	await upload(page);
	const form = page.getByRole("dialog", { name: "Upload Show", exact: true });
	await expect(
		form.getByRole("button", { name: "Uploading…", exact: true }),
	).toBeDisabled();
	await expect(
		form.getByRole("textbox", { name: "title", exact: true }),
	).toBeDisabled();
	await expect(
		form.getByRole("button", { name: "Cancel", exact: true }),
	).toBeDisabled();
	await page.keyboard.press("Escape");
	await expect(form).toBeVisible();
	state.releaseUpload();
	await expect(
		page.getByRole("dialog", { name: "Review Show", exact: true }),
	).toBeVisible();
	expect(state.calls.uploads).toBe(1);
});

for (const width of [1280, 390, 320])
	test(`pending upload survives reload, metadata failure and resume at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		const { calls } = await setup(page, { pending: true, prepareFailures: 1 });
		await page.reload();
		const trigger = page.getByRole("button", {
			name: "pending uploads 1",
			exact: true,
		});
		await expect(trigger).toBeVisible();
		const grid = page.getByRole("button", { name: "grid", exact: true });
		expect(
			await trigger.evaluate(
				(button, next) =>
					Boolean(
						button.compareDocumentPosition(next as Node) &
							Node.DOCUMENT_POSITION_FOLLOWING,
					),
				await grid.elementHandle(),
			),
		).toBe(true);
		await expect(trigger.locator("span")).toHaveCSS(
			"background-color",
			"rgb(204, 0, 0)",
		);
		await page.screenshot({ path: `/tmp/pending-toolbar-${width}.png` });
		await trigger.click();
		const queue = page.getByRole("dialog", {
			name: "Pending uploads",
			exact: true,
		});
		await expect(
			queue.getByRole("button", { name: "Close dialog", exact: true }),
		).toBeFocused();
		if (width === 1280) expect((await queue.boundingBox())?.width).toBe(960);
		await expect(
			queue.getByRole("link", { name: mixcloud.key, exact: true }),
		).toHaveAttribute("href", mixcloud.url);
		await expect(
			queue.getByText(editorial.date, { exact: true }),
		).toBeVisible();
		await page.screenshot({ path: `/tmp/pending-uploads-${width}.png` });
		await queue
			.getByRole("button", { name: `Resume ${editorial.title}`, exact: true })
			.click();
		const failure = page.getByRole("dialog", {
			name: "Uploaded to Mixcloud",
			exact: true,
		});
		await expect(failure.getByRole("alert")).toContainText("Status: HTTP 502");
		await page.keyboard.press("Escape");
		await expect(queue).toBeVisible();
		await queue
			.getByRole("button", { name: "Close dialog", exact: true })
			.click();
		await expect(trigger).toBeFocused();
		await trigger.click();
		await queue
			.getByRole("button", { name: `Resume ${editorial.title}`, exact: true })
			.click();
		const review = page.getByRole("dialog", {
			name: "Review Show",
			exact: true,
		});
		await expect(
			review.getByRole("textbox", { name: "title", exact: true }),
		).toHaveValue(editorial.title);
		await review
			.getByRole("button", { name: "Save Show", exact: true })
			.click();
		const success = page.getByRole("dialog", {
			name: "Show saved",
			exact: true,
		});
		await expect(success).toBeVisible();
		await success.getByRole("button", { name: "Close", exact: true }).click();
		await expect(
			queue.getByText("No pending uploads.", { exact: true }),
		).toBeVisible();
		await queue
			.getByRole("button", { name: "Close dialog", exact: true })
			.click();
		await expect(
			page.getByRole("textbox", { name: "Search Shows", exact: true }),
		).toBeFocused();
		await page.reload();
		await expect(
			page.getByRole("button", { name: /pending uploads/i }),
		).toHaveCount(0);
		expect(calls.uploads).toBe(0);
		expect(calls.prepares).toBe(2);
		expect(calls.saves).toHaveLength(1);
	});

test("pending list failures stay separate from Shows and offer retry", async ({
	page,
}) => {
	await setup(page, { pending: true, pendingFailures: 1 });
	await expect(
		page.getByText("No shows have been added yet.", { exact: true }),
	).toBeVisible();
	await expect(page.getByRole("alert")).toContainText(
		"Pending uploads could not be loaded",
	);
	await expect(
		page.getByRole("button", { name: "pending uploads 1", exact: true }),
	).toHaveCount(0);
	await page
		.getByRole("button", { name: "Retry pending uploads", exact: true })
		.click();
	await page
		.getByRole("button", { name: "pending uploads 1", exact: true })
		.click();
	const queue = page.getByRole("dialog", {
		name: "Pending uploads",
		exact: true,
	});
	await expect(
		queue.getByRole("button", {
			name: `Resume ${editorial.title}`,
			exact: true,
		}),
	).toBeVisible();
	await queue
		.getByRole("button", { name: "Close dialog", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "pending uploads 1", exact: true }),
	).toBeVisible();
});

test("Shows hides pending uploads when the queue is empty", async ({
	page,
}) => {
	await setup(page);
	await expect(
		page.getByText("No shows have been added yet.", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: /pending uploads/i }),
	).toHaveCount(0);
});

test("removing a pending upload retries failures and deletes only its pending record", async ({
	page,
}) => {
	const { calls } = await setup(page, { pending: true, removeFailures: 1 });
	await page
		.getByRole("button", { name: "pending uploads 1", exact: true })
		.click();
	const queue = page.getByRole("dialog", {
		name: "Pending uploads",
		exact: true,
	});
	const remove = queue.getByRole("button", {
		name: `Remove ${editorial.title}`,
		exact: true,
	});
	await remove.click();
	await expect(queue.getByRole("alert")).toContainText("could not be removed");
	await expect(remove).toBeEnabled();
	await remove.click();
	await expect(
		queue.getByText("No pending uploads.", { exact: true }),
	).toBeVisible();
	await queue
		.getByRole("button", { name: "Close dialog", exact: true })
		.click();
	await page.reload();
	await expect(
		page.getByRole("button", { name: /pending uploads/i }),
	).toHaveCount(0);
	expect(calls.removes).toBe(2);
	expect(calls.uploads).toBe(0);
	expect(calls.prepares).toBe(0);
	expect(calls.saves).toHaveLength(0);
});

for (const width of [1280, 390, 320]) {
	test(`special-only upload and review at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		const { calls } = await setup(page, { specialOnly: true });
		const uploadRequest = page.waitForRequest("**/api/admin/mixcloud/upload");
		await upload(page, true);
		expect((await uploadRequest).postDataBuffer()?.toString()).toContain(
			'name="special_id"',
		);
		const form = page.getByRole("dialog", { name: "Review Show", exact: true });
		await expect(
			form.getByRole("button", { name: "Remove Festival", exact: true }),
		).toBeVisible();
		await expect(
			form.getByRole("button", { name: "Save Show", exact: true }),
		).toBeEnabled();
		const group = form
			.getByText("Choose archive DJs or a special to save this show.", {
				exact: true,
			})
			.locator("..");
		await expect(group).toHaveCSS("border-top-color", "rgb(187, 187, 187)");
		await page.screenshot({ path: `/tmp/upload-special-${width}.png` });
		await form.getByRole("button", { name: "Save Show", exact: true }).click();
		await expect(form).toBeHidden();
		expect(calls.saves[0]).toMatchObject({ djs: [], special_id: 7 });
		await page
			.getByRole("dialog", { name: "Show saved", exact: true })
			.getByRole("button", { name: "Close", exact: true })
			.click();
		await page.getByRole("button", { name: "grid", exact: true }).click();
		const card = page.getByRole("article").filter({ hasText: saved.title });
		await expect(card).toContainText("Special: Festival");
		await expect(card).not.toContainText("No DJs");
		await page.screenshot({ path: `/tmp/special-card-${width}.png` });

		expect(calls.uploads).toBe(1);
	});
}

test("resumed upload with a deleted special requires a replacement relationship", async ({
	page,
}) => {
	const { calls } = await setup(page, { pending: true, specialOnly: true });
	await page.route("**/api/admin/specials", (route) =>
		route.fulfill({ json: [] }),
	);
	await page
		.getByRole("button", { name: "pending uploads 1", exact: true })
		.click();
	await page
		.getByRole("button", { name: `Resume ${editorial.title}`, exact: true })
		.click();
	const form = page.getByRole("dialog", { name: "Review Show", exact: true });
	await expect(
		form.getByRole("button", {
			name: "Remove Missing special #7",
			exact: true,
		}),
	).toBeVisible();
	await form.getByRole("button", { name: "Save Show", exact: true }).click();
	await expect(form.getByRole("alert")).toContainText(
		"Selected special no longer exists",
	);
	await form
		.getByRole("button", { name: "Remove Missing special #7", exact: true })
		.click();
	await expect(
		form.getByRole("button", { name: "Save Show", exact: true }),
	).toBeDisabled();
	await form
		.getByRole("combobox", { name: "Search DJs", exact: true })
		.fill("Original");
	await form.getByRole("option", { name: "Original DJ", exact: true }).click();
	await form.getByRole("button", { name: "Save Show", exact: true }).click();
	await expect(form).toBeHidden();
	expect(calls.saves[0]).toMatchObject({ djs: [1], special_id: null });
	expect(calls.uploads).toBe(0);
});

test("generated upload titles put Special before DJs and preserve manual edits", async ({
	page,
}) => {
	await setup(page);
	await page.getByRole("button", { name: "+ show", exact: true }).click();
	const form = page.getByRole("dialog", { name: "Upload Show", exact: true });
	await form
		.getByRole("textbox", { name: "title", exact: true })
		.fill("Show Title");
	await form.getByLabel("date", { exact: true }).fill("2026-10-26");
	await form
		.getByRole("combobox", { name: "Search Special", exact: true })
		.fill("Festival");
	await form.getByRole("option", { name: "Festival", exact: true }).click();
	await form
		.getByRole("combobox", { name: "Search DJs", exact: true })
		.fill("Original");
	await form.getByRole("option", { name: "Original DJ", exact: true }).click();
	const title = form.getByRole("textbox", {
		name: "Mixcloud title",
		exact: true,
	});
	await expect(title).toHaveValue(
		"Festival - Original DJ - Show Title, October 26, 2026",
	);
	await title.fill("Custom provider title");
	await form
		.getByRole("button", { name: "Remove Festival", exact: true })
		.click();
	await expect(title).toHaveValue("Custom provider title");
	await form
		.getByRole("button", { name: "Reset to generated title", exact: true })
		.click();
	await expect(title).toHaveValue("Original DJ - Show Title, October 26, 2026");
});
