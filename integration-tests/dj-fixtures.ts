import { randomUUID } from "node:crypto";
import {
	type APIRequestContext,
	test as base,
	expect,
	type Page,
} from "@playwright/test";
import sharp from "sharp";

type DJ = {
	id: number;
	createdAt: string;
	title: string;
	bio: string;
	socials?: string;
	showTitle?: string;
	showDescription?: string;
	image_small?: string;
	image_large?: string;
	tags: number[];
	directTags: number[];
	shows: number[];
};
export const initial = {
	bio: "Original bio",
	socials: "Original socials",
	showTitle: "Original show",
	showDescription: "Original description",
};
export const imageBuffer = (blue = 20) =>
	sharp({
		create: {
			width: 64,
			height: 64,
			channels: 4,
			background: { r: 20, g: 20, b: blue, alpha: 1 },
		},
	})
		.png()
		.toBuffer();
export const createDJ = async (
	request: APIRequestContext,
	withImage = true,
) => {
	const title = `Integration DJ ${randomUUID()}`;
	const response = await request.post("/api/admin/create-dj", {
		multipart: {
			title,
			...initial,
			tags: title,
			...(withImage
				? {
						image: {
							name: "seed.png",
							mimeType: "image/png",
							buffer: await imageBuffer(),
						},
					}
				: {}),
		},
	});
	expect(response.status(), await response.text()).toBe(201);
	const created = (await response.json()) as DJ;
	return { ...created, directTags: created.tags };
};
export const loadDJ = async (
	request: APIRequestContext,
	id: number,
): Promise<DJ> => {
	const response = await request.get("/api/admin/djs");
	expect(response.ok()).toBeTruthy();
	const dj = ((await response.json()) as DJ[]).find((entry) => entry.id === id);
	expect(dj).toBeDefined();
	return dj as DJ;
};
export const rowFor = (page: Page, id: number) =>
	page
		.getByRole("table", { name: "DJs", exact: true })
		.getByRole("row")
		.filter({
			has: page
				.locator("td:nth-child(2)")
				.filter({ hasText: new RegExp(`^${id}$`) }),
		});
export const cellFor = async (page: Page, id: number, column: string) => {
	await expect(rowFor(page, id)).toBeVisible();
	const headers = await page
		.getByRole("table", { name: "DJs", exact: true })
		.getByRole("columnheader")
		.allTextContents();
	const index = headers.findIndex(
		(header) => header.replace(/[▲▼▽]/g, "").trim() === column,
	);
	expect(index).toBeGreaterThanOrEqual(0);
	return rowFor(page, id).getByRole("cell").nth(index);
};
export const openEditor = async (page: Page, id: number) => {
	await rowFor(page, id)
		.getByRole("button", { name: "Edit", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Edit DJ", exact: true });
	await expect(dialog).toBeVisible();
	return dialog;
};
export const save = async (page: Page) => {
	const response = page.waitForResponse(
		(response) =>
			response.url().endsWith("/api/admin/modify-dj") &&
			response.request().method() === "POST",
	);
	await page
		.getByRole("dialog", { name: "Edit DJ", exact: true })
		.getByRole("button", { name: "Save", exact: true })
		.click();
	expect((await response).status()).toBe(200);
	await expect(
		page.getByRole("dialog", { name: "Edit DJ", exact: true }),
	).toBeHidden();
};
export const imageBytes = async (
	request: APIRequestContext,
	id: number,
	variant = "large",
) => {
	const response = await request.get(`/api/admin/djs/${id}/image/${variant}`);
	expect(response.status()).toBe(200);
	expect(response.headers()["content-type"]).toContain("image/webp");
	return response.body();
};
export const selectImage = async (page: Page) => {
	await page.locator("#edit-dj-image-input").setInputFiles({
		name: "replacement.png",
		mimeType: "image/png",
		buffer: await imageBuffer(190),
	});
	await expect(
		page.getByRole("dialog", { name: "Crop image", exact: true }),
	).toBeVisible();
};
export const test = base.extend<{ dj: DJ }>({
	dj: async ({ request }, use) => {
		await expect
			.poll(
				async () => {
					try {
						return (await request.get("/health")).status();
					} catch {
						return 0;
					}
				},
				{ timeout: 15_000 },
			)
			.toBe(200);
		await use(await createDJ(request));
	},
});
test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});
