import { expect } from "@playwright/test";
import {
	loadShow,
	openShowEditor,
	saveShow,
	showRequest,
	showRow,
	test,
} from "./show-fixtures.js";

test.beforeEach(async ({ page, show }) => {
	await page.goto("/admin/#shows");
	await page.getByRole("button", { name: "table", exact: true }).click();
	await expect(showRow(page, show.id)).toBeVisible();
});

test("edits mixed tracklists as a local draft, retries failed saves and persists on reload", async ({
	page,
	request,
	show,
}) => {
	const parent = await openShowEditor(page, show.id);
	await expect(
		parent.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	const opener = parent.getByRole("button", {
		name: "Edit Tracklist",
		exact: true,
	});
	await opener.click();
	const editor = page.getByRole("dialog", {
		name: "Edit Tracklist",
		exact: true,
	});
	await expect(editor).toBeVisible();
	await expect(editor).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(
		editor.getByRole("button", { name: "Cancel", exact: true }),
	).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(
		editor.getByRole("button", { name: "Close", exact: true }),
	).toBeFocused();
	await expect(parent).toBeHidden();
	await editor
		.getByRole("button", { name: "+ Add track", exact: true })
		.click();
	const first = editor.getByRole("group", {
		name: "Tracklist row 1",
		exact: true,
	});
	await first.getByLabel("artist", { exact: true }).fill(" Artist ");
	await first.getByLabel("song", { exact: true }).fill(" Song ");
	await first.getByLabel("timestamp (optional)").fill("3:70");
	await expect(
		editor.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	await expect(
		first.getByText("Timestamp must use", { exact: false }),
	).toBeVisible();
	await expect(first.getByLabel("timestamp (optional)")).toHaveCSS(
		"border-top-color",
		"rgb(255, 44, 44)",
	);
	await first.getByLabel("timestamp (optional)").fill("3:07");
	await editor
		.getByRole("button", { name: "+ Add track", exact: true })
		.click();
	const second = editor.getByRole("group", {
		name: "Tracklist row 2",
		exact: true,
	});
	await second.getByLabel("artist", { exact: true }).fill("clear me");
	await second.getByLabel("song", { exact: true }).fill("clear me");
	await second.getByLabel("timestamp (optional)").fill("0:00");
	await second.getByLabel("type", { exact: true }).selectOption("chapter");
	await expect(second.getByLabel("chapter", { exact: true })).toHaveValue("");
	await expect(second.getByLabel("timestamp (optional)")).toHaveValue("0:00");
	await second.getByLabel("chapter", { exact: true }).fill("Intro");
	await expect(
		editor.getByText("Enter timestamp as m:ss or h:mm:ss", { exact: true }),
	).toBeVisible();
	await editor.getByRole("button", { name: "Save", exact: true }).click();
	await expect(editor).toBeHidden();
	await expect(opener).toBeFocused();
	await expect(
		parent.getByRole("region", { name: "tracklist", exact: true }),
	).toHaveText("1 | Song, Artist, 3:07\n2 | Intro, 0:00");
	expect((await loadShow(request, show.id)).tracklist).toEqual([]);
	await page.route(
		"**/api/admin/modify-show",
		async (route) => {
			await route.fulfill({
				status: 500,
				json: { error: "Tracklist save failed" },
			});
		},
		{ times: 1 },
	);
	await parent.getByRole("button", { name: "Save", exact: true }).click();
	await expect(parent.getByRole("alert")).toContainText(
		"Tracklist save failed",
	);
	await expect(
		parent.getByRole("region", { name: "tracklist", exact: true }),
	).toContainText("1 | Song, Artist");
	await saveShow(page);
	expect((await loadShow(request, show.id)).tracklist).toEqual([
		{ artist: "Artist", song: "Song", start_time: 187 },
		{ chapter: "Intro", start_time: 0 },
	]);
	await page.reload();
	await openShowEditor(page, show.id);
	await expect(
		parent.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	await opener.click();
	await first.getByLabel("song", { exact: true }).fill("changed");
	await first.getByLabel("song", { exact: true }).fill("Song");
	await expect(
		editor.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	await editor.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(
		parent.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
	await opener.click();
	await first.getByLabel("song", { exact: true }).fill("Another song");
	await editor.getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		parent.getByRole("button", { name: "Save", exact: true }),
	).toBeEnabled();
	await opener.click();
	await first.getByLabel("song", { exact: true }).fill("Song");
	await editor.getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		parent.getByRole("button", { name: "Save", exact: true }),
	).toBeDisabled();
});

test("editor and parent discard are independent; deleting all entries clears the list", async ({
	page,
	request,
	show,
}) => {
	await request.post("/api/admin/modify-show", {
		data: {
			...showRequest(show),
			tracklist: [{ chapter: "Opening", start_time: null }],
		},
	});
	await page.reload();
	const parent = await openShowEditor(page, show.id);
	const open = () =>
		parent.getByRole("button", { name: "Edit Tracklist", exact: true }).click();
	const editor = page.getByRole("dialog", {
		name: "Edit Tracklist",
		exact: true,
	});
	await open();
	await editor.getByLabel("chapter", { exact: true }).fill("Discard this");
	await page.keyboard.press("Escape");
	const discard = page.getByRole("alertdialog");
	await expect(
		discard.getByRole("button", { name: "Keep editing" }),
	).toBeFocused();
	await discard.getByRole("button", { name: "Keep editing" }).click();
	await expect(editor.getByLabel("chapter", { exact: true })).toHaveValue(
		"Discard this",
	);
	await editor.getByRole("button", { name: "Cancel", exact: true }).click();
	await discard.getByRole("button", { name: "Discard changes" }).click();
	await expect(
		parent.getByRole("region", { name: "tracklist", exact: true }),
	).toHaveText("1 | Opening");
	await open();
	await editor.getByRole("button", { name: "Remove row 1" }).click();
	await editor.getByRole("button", { name: "Save", exact: true }).click();
	await parent.getByRole("button", { name: "Cancel", exact: true }).click();
	await discard.getByRole("button", { name: "Discard changes" }).click();
	expect((await loadShow(request, show.id)).tracklist).toEqual([
		{ chapter: "Opening", start_time: null },
	]);
	await openShowEditor(page, show.id);
	await open();
	await editor.getByRole("button", { name: "Remove row 1" }).click();
	await editor.getByRole("button", { name: "Save", exact: true }).click();
	await saveShow(page);
	expect((await loadShow(request, show.id)).tracklist).toEqual([]);
});

for (const width of [1280, 390, 320]) {
	test(`tracklist preview and editor fit and scroll at ${width}px`, async ({
		page,
		request,
		show,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await request.post("/api/admin/modify-show", {
			data: {
				...showRequest(show),
				tracklist: Array.from({ length: 8 }, (_, index) =>
					index % 2 === 0
						? {
								artist: "Long artist name",
								song: "Song with a long title",
								start_time: index * 600,
							}
						: { chapter: "Chapter with a long title", start_time: null },
				),
			},
		});
		await page.reload();
		const parent = await openShowEditor(page, show.id);
		const preview = parent.getByRole("region", {
			name: "tracklist",
			exact: true,
		});
		await preview.scrollIntoViewIfNeeded();
		expect(
			await preview.evaluate(
				(element) => element.scrollHeight > element.clientHeight,
			),
		).toBe(true);
		await preview.focus();
		await page.keyboard.press("End");
		await page.screenshot({ path: `/tmp/tracklist-preview-${width}.png` });
		await parent
			.getByRole("button", { name: "Edit Tracklist", exact: true })
			.click();
		const editor = page.getByRole("dialog", {
			name: "Edit Tracklist",
			exact: true,
		});
		await expect(editor).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		expect(
			await editor.evaluate(
				(element) => element.scrollWidth <= element.clientWidth,
			),
		).toBe(true);
		const tracks = editor
			.getByRole("group", { name: "Tracklist row 1", exact: true })
			.locator("..");
		expect(
			await tracks.evaluate(
				(element) => element.scrollHeight > element.clientHeight,
			),
		).toBe(true);
		await expect(
			editor.getByRole("button", { name: "+ Add track", exact: true }),
		).toBeInViewport();
		await expect(
			editor.getByRole("button", { name: "Save", exact: true }),
		).toBeInViewport();
		await expect(
			editor.getByRole("button", { name: "Cancel", exact: true }),
		).toBeInViewport();
		if (width === 1280) expect((await editor.boundingBox())?.width).toBe(1080);
		await page.screenshot({ path: `/tmp/tracklist-editor-${width}.png` });
		await editor
			.getByRole("button", { name: "+ Add track", exact: true })
			.click();
		const last = editor.getByRole("group", {
			name: "Tracklist row 9",
			exact: true,
		});
		await last.getByLabel("artist", { exact: true }).fill("Last artist");
		await last.getByLabel("song", { exact: true }).fill("Last song");
		await editor.getByRole("button", { name: "Save", exact: true }).click();
		await expect(parent).toBeVisible();
	});
}
