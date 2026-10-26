import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { createDJ, loadDJ } from "./dj-fixtures.js";
import { loadShow, showRequest, test } from "./show-fixtures.js";

test("replaces Show fields and links in PostgreSQL while preserving identity and related records", async ({
	request,
	show,
	dj,
}) => {
	const replacementDJ = await createDJ(request, false);
	const newTag = `Edited tag ${randomUUID()}`;
	const response = await request.post("/api/admin/modify-show", {
		data: {
			...showRequest(show),
			title: " Edited show ",
			date: "2025-01-02",
			duration: 7201,
			url: "https://example.test/edited",
			mixcloud_image_small: "https://example.test/edited-small.jpg",
			mixcloud_image_large: "https://example.test/edited.jpg",
			djs: [replacementDJ.id, replacementDJ.id],
			tags: [show.title.toLowerCase(), newTag, newTag.toLowerCase()],
		},
	});
	expect(response.status(), await response.text()).toBe(200);
	const saved = await response.json();
	expect(saved).toMatchObject({
		id: show.id,
		createdAt: show.createdAt,
		title: "Edited show",
		date: "2025-01-02T00:00:00.000Z",
		duration: 7201,
		url: "https://example.test/edited",
		mixcloud_image_small: "https://example.test/edited-small.jpg",
		mixcloud_image_large: "https://example.test/edited.jpg",
		djs: [replacementDJ.id],
	});
	expect(saved.tags).toHaveLength(2);
	expect(saved.tags).toContain(show.tags[0]);
	expect(await loadShow(request, show.id)).toEqual(saved);
	expect((await loadDJ(request, dj.id)).shows).not.toContain(show.id);
	expect((await loadDJ(request, replacementDJ.id)).shows).toContain(show.id);

	const cleared = await request.post("/api/admin/modify-show", {
		data: { ...showRequest(saved), tags: [] },
	});
	expect(cleared.status()).toBe(200);
	const reloaded = await loadShow(request, show.id);
	expect(reloaded.mixcloud_image_small).toBe(saved.mixcloud_image_small);
	expect(reloaded.mixcloud_image_large).toBe(saved.mixcloud_image_large);
	expect(reloaded.tags).toEqual([]);
	const tags = await request.get("/api/admin/tags");
	expect(tags.ok()).toBeTruthy();
	expect((await tags.json()).map((tag: { id: number }) => tag.id)).toEqual(
		expect.arrayContaining(saved.tags),
	);
	expect((await loadDJ(request, replacementDJ.id)).tags).not.toEqual(
		expect.arrayContaining(show.tags),
	);
});

test("rejects invalid edits and missing records without changing persisted Show data", async ({
	request,
	show,
}) => {
	for (const changes of [
		{ date: "2024-02-30" },
		{ duration: 0 },
		{ url: "relative" },
		{ mixcloud_image_small: undefined },
		{ mixcloud_image_small: null },
		{ mixcloud_image_small: "" },
		{ mixcloud_image_small: "relative" },
		{ mixcloud_image_small: "ftp://example.test/image" },
		{ mixcloud_image_large: undefined },
		{ mixcloud_image_large: null },
		{ mixcloud_image_large: "" },
		{ mixcloud_image_large: "relative" },
		{ mixcloud_image_large: "ftp://example.test/image" },
		{ djs: [] },
		{ djs: [2147483647] },
		{ id: 0 },
	]) {
		const response = await request.post("/api/admin/modify-show", {
			data: { ...showRequest(show), tags: [show.title], ...changes },
		});
		expect(response.status(), await response.text()).toBe(400);
		expect(await loadShow(request, show.id)).toEqual(show);
	}
	const response = await request.post("/api/admin/modify-show", {
		data: { ...showRequest(show), id: 2147483647 },
	});
	expect(response.status()).toBe(404);
	expect(await loadShow(request, show.id)).toEqual(show);
});
