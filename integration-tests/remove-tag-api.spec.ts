import { expect } from "@playwright/test";
import pg from "pg";
import { loadDJ } from "./dj-fixtures.js";
import { loadShow, test } from "./show-fixtures.js";

test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});

test("tag hard deletion cascades links and preserves Shows, DJs and other tags", async ({
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
		await pool.query(
			"INSERT INTO show_tags (show_id, tag_id) VALUES ($1, $2)",
			[show.id, id],
		);
		const beforeDJ = await loadDJ(request, dj.id);
		const beforeShow = await loadShow(request, show.id);
		const preview = await request.get(`/api/admin/tags/${id}/delete-impact`);
		expect(preview.status()).toBe(200);
		expect(await preview.json()).toEqual({
			tag: { id, title: dj.title },
			shows: [{ id: show.id, title: show.title }],
			djs: [{ id: dj.id, title: dj.title, assignment: "both" }],
		});
		const response = await request.post("/api/admin/remove-tag", {
			data: { id },
		});
		expect(response.status(), await response.text()).toBe(200);
		expect(await response.json()).toEqual({ id });
		for (const table of ["tags", "show_tags", "dj_tags"]) {
			const column = table === "tags" ? "id" : "tag_id";
			expect(
				(await pool.query(`SELECT * FROM ${table} WHERE ${column} = $1`, [id]))
					.rows,
			).toEqual([]);
		}
		expect(await loadShow(request, show.id)).toEqual({
			...beforeShow,
			tags: beforeShow.tags.filter((tag) => tag !== id),
		});
		expect(await loadDJ(request, dj.id)).toEqual({
			...beforeDJ,
			tags: beforeDJ.tags.filter((tag) => tag !== id),
			directTags: beforeDJ.directTags.filter((tag) => tag !== id),
		});
		expect(
			(await pool.query("SELECT id FROM tags WHERE id = $1", [show.tags[0]]))
				.rowCount,
		).toBe(1);
		expect(
			(await request.get(`/api/admin/tags/${id}/delete-impact`)).status(),
		).toBe(404);
		expect(
			(await request.post("/api/admin/remove-tag", { data: { id } })).status(),
		).toBe(404);
		const empty = await request.post("/api/admin/create-tag", {
			data: { title: `Unused ${show.title}` },
		});
		const unused = await empty.json();
		expect(
			await (
				await request.get(`/api/admin/tags/${unused.id}/delete-impact`)
			).json(),
		).toEqual({
			tag: { id: unused.id, title: unused.title },
			shows: [],
			djs: [],
		});
		expect(
			(
				await request.post("/api/admin/remove-tag", { data: { id: unused.id } })
			).status(),
		).toBe(200);
	} finally {
		await pool.end();
	}
});
