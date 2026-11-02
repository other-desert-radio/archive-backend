import { expect } from "@playwright/test";
import pg from "pg";
import { classifyMixcloudImport } from "../src/utils/mixcloud-import-status.js";
import { loadDJ } from "./dj-fixtures.js";
import { showRequest, test } from "./show-fixtures.js";

for (const ready of [true, false]) {
	test(`Show deletion preserves source and supports reimport (ready=${ready})`, async ({
		request,
		show,
		dj,
	}) => {
		const pool = new pg.Pool({
			connectionString:
				"postgres://integration:integration@postgres:5432/archive_integration",
		});
		try {
			const key = `/delete-test/${show.id}/`;
			await pool.query(
				`INSERT INTO mixcloud_import (key, show_id, imported_at, derived_title, derived_date, decoded_djs, parser_version, parser_key, date_source) VALUES ($1,$2,now(),$3,now(),$4,1,'test',$5)`,
				[
					key,
					show.id,
					show.title,
					[dj.title],
					ready ? "title" : "created_time",
				],
			);
			await pool.query(
				`INSERT INTO mixcloud_uploads (title,date,djs,tags,mixcloud_title,mixcloud_key,show_id) VALUES ($1,now(),$2,'{}',$1,$3,$4)`,
				[show.title, [dj.id], key, show.id],
			);
			const before = (
				await pool.query("SELECT * FROM mixcloud_import WHERE key=$1", [key])
			).rows[0];
			const response = await request.post("/api/admin/remove-show", {
				data: { id: show.id },
			});
			expect(response.status(), await response.text()).toBe(200);
			expect(await response.json()).toEqual({ id: show.id });
			expect(
				(await pool.query("SELECT * FROM mixcloud_import WHERE key=$1", [key]))
					.rows[0],
			).toEqual({ ...before, show_id: null, imported_at: null });
			for (const table of ["show_djs", "show_tags", "mixcloud_uploads"])
				expect(
					(
						await pool.query(`SELECT * FROM ${table} WHERE show_id=$1`, [
							show.id,
						])
					).rows,
				).toEqual([]);
			expect((await loadDJ(request, dj.id)).shows).not.toContain(show.id);
			expect(
				(await pool.query("SELECT id FROM tags WHERE id=ANY($1)", [show.tags]))
					.rows,
			).toHaveLength(show.tags.length);
			const status = await request.get("/api/admin/mixcloud-import/status");
			expect(status.ok()).toBe(true);
			const imports = await request.get("/api/admin/mixcloud-imports");
			const source = (await imports.json()).find(
				(row: { key: string }) => row.key === key,
			);
			expect(classifyMixcloudImport(source)).toBe(
				ready ? "auto_parsed" : "unparsable",
			);
			expect(source.show_id).toBeUndefined();
			expect(source.imported_at).toBeUndefined();
			const reimport = await request.post("/api/admin/create-show", {
				data: { ...showRequest(show), mixcloud_import_id: before.id },
			});
			expect(reimport.status(), await reimport.text()).toBe(201);
			expect((await reimport.json()).id).not.toBe(show.id);
			expect(
				(
					await request.post("/api/admin/remove-show", {
						data: { id: show.id },
					})
				).status(),
			).toBe(404);
		} finally {
			await pool.end();
		}
	});
}
