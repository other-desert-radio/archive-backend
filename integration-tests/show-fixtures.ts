import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { test as djTest } from "./dj-fixtures.js";

export type Show = {
	id: number;
	createdAt: string;
	title: string;
	date: string;
	duration: number;
	image?: string;
	url: string;
	djs: number[];
	tags: number[];
};

export const loadShow = async (
	request: APIRequestContext,
	id: number,
): Promise<Show> => {
	const response = await request.get("/api/admin/shows");
	expect(response.ok()).toBeTruthy();
	const show = ((await response.json()) as Show[]).find(
		(entry) => entry.id === id,
	);
	expect(show).toBeDefined();
	return show as Show;
};

export const showRequest = (show: Show) => ({
	id: show.id,
	title: show.title,
	date: show.date.slice(0, 10),
	duration: show.duration,
	url: show.url,
	djs: show.djs,
	...(show.image === undefined ? {} : { image: show.image }),
});

export const test = djTest.extend<{ show: Show }>({
	show: async ({ request, dj }, use) => {
		const title = `Integration Show ${randomUUID()}`;
		const response = await request.post("/api/admin/create-show", {
			data: {
				title,
				date: "2024-02-29",
				duration: 3661,
				url: "https://example.test/show",
				image: "https://example.test/original.jpg",
				djs: [dj.id],
				tags: [title],
			},
		});
		expect(response.status(), await response.text()).toBe(201);
		await use(await response.json());
	},
});

export const showRow = (page: Page, id: number) =>
	page
		.getByRole("table", { name: "Shows", exact: true })
		.getByRole("row")
		.filter({
			has: page
				.locator("td:nth-child(2)")
				.filter({ hasText: new RegExp(`^${id}$`) }),
		});
export const openShowEditor = async (page: Page, id: number) => {
	await showRow(page, id)
		.getByRole("button", { name: "Edit", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Edit Show", exact: true });
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByRole("searchbox", { name: "Search DJs", exact: true }),
	).toBeVisible();
	return dialog;
};
export const saveShow = async (page: Page) => {
	const response = page.waitForResponse(
		(response) =>
			response.url().endsWith("/api/admin/modify-show") &&
			response.request().method() === "POST",
	);
	await page
		.getByRole("dialog", { name: "Edit Show", exact: true })
		.getByRole("button", { name: "Save", exact: true })
		.click();
	expect((await response).status()).toBe(200);
	await expect(
		page.getByRole("dialog", { name: "Edit Show", exact: true }),
	).toBeHidden();
};
