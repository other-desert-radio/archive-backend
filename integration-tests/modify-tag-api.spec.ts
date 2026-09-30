import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import pg from "pg";
import { loadDJ } from "./dj-fixtures.js";
import { loadShow, test } from "./show-fixtures.js";

test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});

// Direct assertions use only the disposable Compose database, never local archive data.
test("edits a linked Tag without replacing timestamps or relationship rows", async ({
	request,
	dj,
	show,
}) => {
	const pool = new pg.Pool({
		connectionString:
			"postgres://integration:integration@postgres:5432/archive_integration",
	});
	try {
		const id = dj.directTags[0];
		expect(id).toBeDefined();
		const before = await pool.query("SELECT * FROM tags WHERE id = $1", [id]);
		await pool.query(
			"INSERT INTO show_tags (show_id, tag_id) VALUES ($1, $2)",
			[show.id, id],
		);
		const links = async () => ({
			dj: (
				await pool.query(
					"SELECT * FROM dj_tags WHERE tag_id = $1 ORDER BY id",
					[id],
				)
			).rows,
			show: (
				await pool.query(
					"SELECT * FROM show_tags WHERE tag_id = $1 ORDER BY id",
					[id],
				)
			).rows,
		});
		const originalLinks = await links();
		const title = `Edited Tag ${randomUUID()}`;
		const payload = {
			id,
			title: ` ${title} `,
			color: " #AbC123 ",
			mixcloud_key: " /genres/new/ ",
			mixcloud_url: " https://example.test/new ",
		};
		const response = await request.post("/api/admin/modify-tag", {
			data: payload,
		});
		expect(response.status(), await response.text()).toBe(200);
		const saved = await response.json();
		expect(saved).toEqual({
			id,
			title,
			color: "#AbC123",
			reviewed: true,
			mixcloud_key: "/genres/new/",
			mixcloud_url: "https://example.test/new",
		});
		const after = await pool.query("SELECT * FROM tags WHERE id = $1", [id]);
		expect(after.rows[0].createdAt).toEqual(before.rows[0].createdAt);
		expect(after.rows[0].id).toBe(id);
		expect(await links()).toEqual(originalLinks);
		expect((await loadDJ(request, dj.id)).directTags).toContain(id);
		expect((await loadShow(request, show.id)).tags).toContain(id);
		const loaded = await request.get("/api/admin/tags");
		expect(
			(await loaded.json()).find((tag: { id: number }) => tag.id === id),
		).toEqual(saved);
		for (const change of [
			{ title: show.title.toUpperCase() },
			{ color: "#fff" },
			{ mixcloud_url: "relative" },
			{ id: 0 },
		]) {
			const rejected = await request.post("/api/admin/modify-tag", {
				data: { ...payload, ...change },
			});
			expect(rejected.status()).toBe(400);
			expect(
				(await pool.query("SELECT * FROM tags WHERE id = $1", [id])).rows,
			).toEqual(after.rows);
			expect(await links()).toEqual(originalLinks);
		}
		expect(
			(
				await request.post("/api/admin/modify-tag", {
					data: { ...payload, id: 2147483647 },
				})
			).status(),
		).toBe(404);
		expect(
			(
				await request.post("/api/admin/modify-tag", {
					data: { ...payload, id: Number.MAX_SAFE_INTEGER },
				})
			).status(),
		).toBe(404);
		const cleared = await request.post("/api/admin/modify-tag", {
			data: {
				id,
				title: title.toUpperCase(),
				color: saved.color,
				mixcloud_url: " ",
			},
		});
		expect(cleared.status()).toBe(200);
		expect(await cleared.json()).toEqual({
			id,
			title: title.toUpperCase(),
			color: saved.color,
			reviewed: true,
		});
		expect(await links()).toEqual(originalLinks);
	} finally {
		await pool.end();
	}
});
