import { expect } from "@playwright/test";
import sharp from "sharp";
import {
	cellFor,
	createDJ,
	imageBytes,
	initial,
	loadDJ,
	openEditor,
	rowFor,
	save,
	selectImage,
	test,
} from "./dj-fixtures.js";

test.beforeEach(async ({ page, dj }) => {
	await page.goto("/admin/#djs");
	await expect(rowFor(page, dj.id)).toBeVisible();
});

for (const [field, label] of Object.entries({
	title: "title",
	bio: "bio",
	socials: "socials",
	showTitle: "show title",
	showDescription: "show description",
})) {
	test(`edits ${label} and persists it in the table and editor`, async ({
		page,
		request,
		dj,
	}) => {
		const before = await loadDJ(request, dj.id);
		const bytes = await imageBytes(request, dj.id);
		const dialog = await openEditor(page, dj.id);
		await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(
			field === "title" ? dj.title : initial[field as keyof typeof initial],
		);
		const value = `Updated ${label} & <literal>`;
		await dialog.getByLabel(label, { exact: true }).fill(`  ${value}  `);
		await save(page);
		await expect(await cellFor(page, dj.id, label)).toHaveText(value);
		await page.reload();
		await expect(await cellFor(page, dj.id, label)).toHaveText(value);
		await expect(
			(await openEditor(page, dj.id)).getByLabel(label, { exact: true }),
		).toHaveValue(value);
		const after = await loadDJ(request, dj.id);
		const { [field as keyof typeof before]: _old, ...unchangedBefore } = before;
		const { [field as keyof typeof after]: _new, ...unchangedAfter } = after;
		expect(unchangedAfter).toEqual(unchangedBefore);
		expect(await imageBytes(request, dj.id)).toEqual(bytes);
	});
}

for (const label of ["socials", "show title", "show description"]) {
	test(`clears optional ${label}`, async ({ page, dj }) => {
		await (await openEditor(page, dj.id))
			.getByLabel(label, { exact: true })
			.fill("   ");
		await save(page);
		await expect(await cellFor(page, dj.id, label)).toHaveText("None");
		await page.reload();
		await expect(await cellFor(page, dj.id, label)).toHaveText("None");
		await expect(
			(await openEditor(page, dj.id)).getByLabel(label, { exact: true }),
		).toHaveValue("");
	});
}

test("displays every column and preserves linked shows and inherited tags", async ({
	page,
	request,
	dj,
}) => {
	const inheritedTitle = `Inherited ${dj.title}`;
	const response = await request.post("/api/admin/create-show", {
		data: {
			title: `Show ${dj.title}`,
			date: "2026-09-24",
			duration: 3600,
			url: "https://example.test/show",
			djs: [dj.id],
			tags: [inheritedTitle],
		},
	});
	expect(response.status(), await response.text()).toBe(201);
	const linked = await loadDJ(request, dj.id);
	await page.reload();
	const expected = {
		id: String(dj.id),
		"created at": `${new Date(dj.createdAt).toISOString().slice(0, 19).replace("T", " ")} UTC`,
		title: dj.title,
		bio: initial.bio,
		socials: initial.socials,
		"show title": initial.showTitle,
		"show description": initial.showDescription,
		tags: linked.tags.join(", "),
		shows: linked.shows.join(", "),
		image_small: "image_small",
		image_large: "image_large",
	};
	for (const [column, value] of Object.entries(expected))
		await expect(await cellFor(page, dj.id, column)).toHaveText(value);
	for (const variant of ["small", "large"])
		await expect(
			(await cellFor(page, dj.id, `image_${variant}`)).getByRole("link"),
		).toHaveAttribute("href", `/api/admin/djs/${dj.id}/image/${variant}`);
	const dialog = await openEditor(page, dj.id);
	await expect(dialog.getByText(inheritedTitle, { exact: true })).toBeVisible();
	await expect(
		dialog.getByRole("button", {
			name: `Remove ${inheritedTitle}`,
			exact: true,
		}),
	).toHaveCount(0);
	await dialog
		.getByRole("button", { name: `Remove ${dj.title}`, exact: true })
		.click();
	await save(page);
	await page.reload();
	const after = await loadDJ(request, dj.id);
	expect(after.directTags).toEqual([]);
	expect(after.tags).toEqual(
		linked.tags.filter((id) => !linked.directTags.includes(id)),
	);
	expect(after.shows).toEqual(linked.shows);
	expect(after.createdAt).toBe(linked.createdAt);
	await expect(await cellFor(page, dj.id, "tags")).toHaveText(
		after.tags.join(", "),
	);
	await expect(await cellFor(page, dj.id, "shows")).toHaveText(
		after.shows.join(", "),
	);
	await expect(
		(await openEditor(page, dj.id)).getByText(inheritedTitle, { exact: true }),
	).toBeVisible();
});

test("adds existing and draft tags, removes one, and clears direct tags", async ({
	page,
	request,
	dj,
}) => {
	const other = await createDJ(request, false);
	const newTag = `New ${dj.title}`;
	let dialog = await openEditor(page, dj.id);
	await dialog.getByLabel("tags", { exact: true }).fill(other.title);
	await dialog.getByRole("option", { name: other.title, exact: true }).click();
	await dialog.getByLabel("tags", { exact: true }).fill(newTag);
	await save(page);
	await page.reload();
	const tagsResponse = await request.get("/api/admin/tags");
	expect(tagsResponse.ok()).toBeTruthy();
	const tags = (await tagsResponse.json()) as { id: number; title: string }[];
	const newId = tags.find((tag) => tag.title === newTag)?.id;
	expect(newId).toBeDefined();
	const added = await loadDJ(request, dj.id);
	expect(added.directTags).toEqual(
		expect.arrayContaining([...dj.tags, ...other.tags, newId]),
	);
	expect(added.directTags).toHaveLength(3);
	await expect(await cellFor(page, dj.id, "tags")).toHaveText(
		added.tags.join(", "),
	);
	dialog = await openEditor(page, dj.id);
	for (const title of [dj.title, other.title, newTag])
		await expect(
			dialog.getByRole("button", { name: `Remove ${title}`, exact: true }),
		).toBeVisible();
	await dialog
		.getByRole("button", { name: `Remove ${other.title}`, exact: true })
		.click();
	await save(page);
	expect((await loadDJ(request, dj.id)).directTags).not.toContain(
		other.tags[0],
	);
	dialog = await openEditor(page, dj.id);
	for (const title of [dj.title, newTag])
		await dialog
			.getByRole("button", { name: `Remove ${title}`, exact: true })
			.click();
	await save(page);
	await page.reload();
	await expect(await cellFor(page, dj.id, "tags")).toHaveText("None");
	expect((await loadDJ(request, dj.id)).directTags).toEqual([]);
});

for (const withImage of [true, false]) {
	test(`${withImage ? "replaces" : "adds"} an image with a cropped preview and persisted variants`, async ({
		page,
		request,
		dj,
	}) => {
		const target = withImage ? dj : await createDJ(request, false);
		const before = withImage ? await imageBytes(request, target.id) : undefined;
		await page.reload();
		await openEditor(page, target.id);
		await selectImage(page);
		await page.getByRole("button", { name: "Use image", exact: true }).click();
		await expect(
			page.getByRole("img", { name: "Selected preview", exact: true }),
		).toHaveAttribute("src", /^blob:/);
		await save(page);
		await page.reload();
		for (const [variant, size] of [
			["small", 400],
			["large", 1024],
		] as const) {
			const bytes = await imageBytes(request, target.id, variant);
			expect(await sharp(bytes).metadata()).toMatchObject({
				format: "webp",
				width: size,
				height: size,
			});
			if (variant === "large" && before)
				expect(bytes.equals(before)).toBe(false);
			await expect(
				(await cellFor(page, target.id, `image_${variant}`)).getByRole("link"),
			).toHaveAttribute("href", `/api/admin/djs/${target.id}/image/${variant}`);
		}
		await expect(
			(await openEditor(page, target.id)).getByRole("img", {
				name: `${target.title} current`,
				exact: true,
			}),
		).toBeVisible();
	});
}

test("undoes removal, cancels cropping, then removes both image variants", async ({
	page,
	request,
	dj,
}) => {
	const before = await imageBytes(request, dj.id);
	let dialog = await openEditor(page, dj.id);
	await dialog.getByRole("button", { name: "Remove", exact: true }).click();
	await dialog.getByRole("button", { name: "Undo", exact: true }).click();
	await selectImage(page);
	await page
		.getByRole("dialog", { name: "Crop image", exact: true })
		.getByRole("button", { name: "Cancel", exact: true })
		.click();
	await expect(
		dialog.getByRole("img", { name: `${dj.title} current`, exact: true }),
	).toBeVisible();
	await save(page);
	expect(await imageBytes(request, dj.id)).toEqual(before);
	dialog = await openEditor(page, dj.id);
	await dialog.getByRole("button", { name: "Remove", exact: true }).click();
	await save(page);
	await page.reload();
	for (const variant of ["small", "large"]) {
		await expect(await cellFor(page, dj.id, `image_${variant}`)).toHaveText(
			"None",
		);
		expect(
			(await request.get(`/api/admin/djs/${dj.id}/image/${variant}`)).status(),
		).toBe(404);
	}
	await expect((await openEditor(page, dj.id)).getByRole("img")).toHaveCount(0);
});

for (const label of ["title", "bio"])
	for (const value of ["", "   "]) {
		test(`rejects ${value === "" ? "empty" : "whitespace"} ${label}`, async ({
			page,
			request,
			dj,
		}) => {
			const before = await loadDJ(request, dj.id);
			const dialog = await openEditor(page, dj.id);
			let submissions = 0;
			page.on("request", (request) => {
				if (request.url().endsWith("/api/admin/modify-dj")) submissions += 1;
			});
			await dialog.getByLabel(label, { exact: true }).fill(value);
			await dialog.getByRole("button", { name: "Save", exact: true }).click();
			await expect(dialog).toBeVisible();
			if (value === "")
				expect(
					await dialog
						.getByLabel(label, { exact: true })
						.evaluate(
							(element: HTMLInputElement) => element.validity.valueMissing,
						),
				).toBe(true);
			else
				await expect(dialog.getByRole("alert")).toHaveText(
					"Title and bio are required.",
				);
			await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
			expect(submissions).toBe(0);
			expect(await loadDJ(request, dj.id)).toEqual(before);
		});
	}

for (const dismissal of ["Cancel", "Escape"]) {
	test(`${dismissal} discards metadata, tags, and image removal`, async ({
		page,
		request,
		dj,
	}) => {
		const before = await loadDJ(request, dj.id);
		const bytes = await imageBytes(request, dj.id);
		const dialog = await openEditor(page, dj.id);
		await dialog.getByLabel("title", { exact: true }).fill("Discarded edit");
		await dialog
			.getByRole("button", { name: `Remove ${dj.title}`, exact: true })
			.click();
		await dialog.getByRole("button", { name: "Remove", exact: true }).click();
		if (dismissal === "Escape") await page.keyboard.press("Escape");
		else
			await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(dialog).toBeHidden();
		await page.reload();
		expect(await loadDJ(request, dj.id)).toEqual(before);
		expect(await imageBytes(request, dj.id)).toEqual(bytes);
		await expect(
			(await openEditor(page, dj.id)).getByLabel("title", { exact: true }),
		).toHaveValue(dj.title);
	});
}

test("rejects an undecodable image and preserves the DJ", async ({
	page,
	request,
	dj,
}) => {
	const before = await loadDJ(request, dj.id);
	const bytes = await imageBytes(request, dj.id);
	const dialog = await openEditor(page, dj.id);
	await page.locator("#edit-dj-image-input").setInputFiles({
		name: "broken.png",
		mimeType: "image/png",
		buffer: Buffer.from("not an image"),
	});
	await expect(dialog.getByRole("alert")).toContainText(
		"Image could not be opened",
	);
	await expect(
		page.getByRole("dialog", { name: "Crop image", exact: true }),
	).toHaveCount(0);
	await dialog.getByRole("button", { name: "Save", exact: true }).click();
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	expect(await loadDJ(request, dj.id)).toEqual(before);
	expect(await imageBytes(request, dj.id)).toEqual(bytes);
});

test("commits a focused draft before removing a tag chip", async ({
	page,
	request,
	dj,
}) => {
	const dialog = await openEditor(page, dj.id);
	const draft = `Draft ${dj.title}`;
	await dialog.getByLabel("tags", { exact: true }).fill(draft);
	await dialog
		.getByRole("button", { name: `Remove ${dj.title}`, exact: true })
		.click();
	await expect(
		dialog.getByRole("button", { name: `Remove ${dj.title}`, exact: true }),
	).toHaveCount(0);
	await expect(
		dialog.getByRole("button", { name: `Remove ${draft}`, exact: true }),
	).toBeVisible();
	await save(page);
	await page.reload();
	const persisted = await loadDJ(request, dj.id);
	expect(persisted.directTags).toHaveLength(1);
	expect(persisted.directTags).not.toContain(dj.tags[0]);
	await expect(await cellFor(page, dj.id, "tags")).toHaveText(
		persisted.tags.join(", "),
	);
	await expect(
		(await openEditor(page, dj.id)).getByRole("button", {
			name: `Remove ${draft}`,
			exact: true,
		}),
	).toBeVisible();
});
