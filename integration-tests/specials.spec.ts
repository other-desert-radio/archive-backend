import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { showRequest, test } from "./show-fixtures.js";

for (const width of [1280, 390, 320]) {
	test(`specials creation, search, views and guarded deletion at ${width}px`, async ({
		page,
		request,
		show,
	}) => {
		let title = `Special ${randomUUID()}`;
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/admin/#specials");
		await expect(
			page.getByRole("link", { name: "⤷ specials" }),
		).toHaveAttribute("aria-current", "page");
		await page.getByRole("button", { name: "+ special", exact: true }).click();
		const form = page.getByRole("dialog", {
			name: "Create special",
			exact: true,
		});
		await expect(
			form.getByRole("button", { name: "Create", exact: true }),
		).toBeDisabled();
		await form
			.getByRole("textbox", { name: "name", exact: true })
			.fill(`  ${title}  `);
		await form
			.getByRole("textbox", { name: "description", exact: true })
			.fill("Late sessions\nWith friends");
		await page.screenshot({ path: `/tmp/specials-create-${width}.png` });
		await form.getByRole("button", { name: "Create", exact: true }).click();
		await expect(form).toBeHidden();
		const list = await request.get("/api/admin/specials");
		const special = (await list.json()).find(
			(row: { title: string }) => row.title === title,
		);
		expect(special).toBeDefined();
		expect(special.description).toContain("Late sessions<br />With friends");
		try {
			const assigned = await request.post("/api/admin/modify-show", {
				data: { ...showRequest(show), tags: [], special_id: special.id },
			});
			expect(assigned.status(), await assigned.text()).toBe(200);
			await page.reload();
			await page
				.getByRole("textbox", { name: "Search Specials" })
				.fill(show.title);
			const row = page.getByRole("row").filter({ hasText: title });
			await expect(row).toContainText(show.title);
			await expect(
				row.getByRole("button", { name: "Edit", exact: true }),
			).toBeEnabled();
			await row.getByRole("button", { name: "Edit", exact: true }).click();
			const edit = page.getByRole("dialog", {
				name: "Edit special",
				exact: true,
			});
			await expect(
				edit.getByRole("textbox", { name: "description", exact: true }),
			).toHaveValue("Late sessions\nWith friends");
			await edit
				.getByRole("textbox", { name: "name", exact: true })
				.fill("   ");
			await expect(
				edit.getByRole("button", { name: "Save", exact: true }),
			).toBeDisabled();
			title += " renamed";
			await edit
				.getByRole("textbox", { name: "name", exact: true })
				.fill(title);
			await page.screenshot({ path: `/tmp/specials-edit-${width}.png` });
			if (width === 1280) {
				await page.route(
					"**/api/admin/modify-special",
					(route) =>
						route.fulfill({ status: 500, json: { error: "Unavailable" } }),
					{ times: 1 },
				);
				await edit.getByRole("button", { name: "Save", exact: true }).click();
				await expect(edit.getByRole("alert")).toBeVisible();
				await expect(
					edit.getByRole("textbox", { name: "name", exact: true }),
				).toHaveValue(title);
			}
			await edit.getByRole("button", { name: "Save", exact: true }).click();
			await expect(edit).toBeHidden();
			await expect(row).toContainText(show.title);
			await page.screenshot({ path: `/tmp/specials-table-${width}.png` });
			await row.getByRole("button", { name: "Delete", exact: true }).click();
			const dialog = page.getByRole("alertdialog", {
				name: "Delete Special?",
				exact: true,
			});
			await expect(dialog.getByText(show.title, { exact: true })).toBeVisible();
			await expect(
				dialog.getByRole("button", { name: "Delete Special", exact: true }),
			).toBeDisabled();
			await expect(
				dialog.getByRole("button", { name: "Cancel", exact: true }),
			).toBeFocused();
			await page.screenshot({ path: `/tmp/specials-blocked-${width}.png` });
			expect(
				(
					await request.post("/api/admin/remove-special", {
						data: { id: special.id },
					})
				).status(),
			).toBe(409);
			await page.keyboard.press("Escape");
			await expect(
				row.getByRole("button", { name: "Delete", exact: true }),
			).toBeFocused();
			const unlinked = await request.post("/api/admin/modify-show", {
				data: { ...showRequest(show), tags: [], special_id: null },
			});
			expect(unlinked.status(), await unlinked.text()).toBe(200);
			await page.getByRole("textbox", { name: "Search Specials" }).fill(title);
			await page.getByRole("button", { name: "grid", exact: true }).click();
			await page.reload();
			const card = page.getByRole("article", {
				name: `Special ${title}`,
				exact: true,
			});
			await expect(card).toBeVisible();
			await expect(card).not.toContainText(show.title);
			await expect(
				card.getByRole("button", { name: `Edit ${title}`, exact: true }),
			).toBeEnabled();
			await page.screenshot({ path: `/tmp/specials-grid-${width}.png` });
			await card
				.getByRole("button", { name: `Delete ${title}`, exact: true })
				.click();
			await expect(
				dialog.getByRole("button", { name: "Delete Special", exact: true }),
			).toBeEnabled();
			await dialog
				.getByRole("button", { name: "Delete Special", exact: true })
				.click();
			await expect(dialog).toBeHidden();
			await expect(card).toHaveCount(0);
			await expect(
				page.getByRole("status").filter({ hasText: title }),
			).toBeVisible();
		} finally {
			await request.post("/api/admin/modify-show", {
				data: { ...showRequest(show), tags: [], special_id: null },
			});
			await request.post("/api/admin/remove-special", {
				data: { id: special.id },
			});
		}
	});
}

test("special forms retain failed drafts and deletion reloads after a concurrent association", async ({
	page,
	request,
	show,
}) => {
	const title = `Retry special ${randomUUID()}`;
	await page.goto("/admin/#specials");
	await page.getByRole("button", { name: "+ special", exact: true }).click();
	const form = page.getByRole("dialog", {
		name: "Create special",
		exact: true,
	});
	await form.getByRole("textbox", { name: "name", exact: true }).fill(title);
	await page.route(
		"**/api/admin/create-special",
		(route) =>
			route.fulfill({ status: 500, json: { error: "Please retry creation." } }),
		{ times: 1 },
	);
	await form.getByRole("button", { name: "Create", exact: true }).click();
	await expect(form.getByRole("alert")).toContainText("Please retry creation.");
	await expect(
		form.getByRole("textbox", { name: "name", exact: true }),
	).toHaveValue(title);
	await form.getByRole("button", { name: "Create", exact: true }).click();
	await expect(form).toBeHidden();
	const special = (
		await (await request.get("/api/admin/specials")).json()
	).find((row: { title: string }) => row.title === title);
	try {
		await page.getByRole("button", { name: "table", exact: true }).click();
		await page.getByRole("textbox", { name: "Search Specials" }).fill(title);
		const row = page.getByRole("row").filter({ hasText: title });
		await page.route(
			`**/api/admin/specials/${special.id}/delete-impact`,
			(route) =>
				route.fulfill({ status: 500, json: { error: "Preview unavailable." } }),
			{ times: 1 },
		);
		await row.getByRole("button", { name: "Delete", exact: true }).click();
		const dialog = page.getByRole("alertdialog", {
			name: "Delete Special?",
			exact: true,
		});
		const remove = dialog.getByRole("button", {
			name: "Delete Special",
			exact: true,
		});
		await expect(dialog.getByRole("alert")).toContainText(
			"Preview unavailable.",
		);
		await expect(remove).toBeDisabled();
		await dialog.getByRole("button", { name: "Retry", exact: true }).click();
		await expect(remove).toBeEnabled();
		const assigned = await request.post("/api/admin/modify-show", {
			data: { ...showRequest(show), tags: [], special_id: special.id },
		});
		expect(assigned.status(), await assigned.text()).toBe(200);
		await remove.click();
		await expect(dialog.getByText(show.title, { exact: true })).toBeVisible();
		await expect(remove).toBeDisabled();
		await expect(dialog.getByRole("alert")).toContainText(
			"Remove this Special",
		);
		await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	} finally {
		await request.post("/api/admin/modify-show", {
			data: { ...showRequest(show), tags: [], special_id: null },
		});
		await request.post("/api/admin/remove-special", {
			data: { id: special.id },
		});
	}
});

for (const width of [1280, 390, 320]) {
	test(`show special assignment, replacement and clearing at ${width}px`, async ({
		page,
		request,
		show,
		dj,
	}) => {
		const created = await request.post("/api/admin/create-special", {
			data: { title: `Assignment ${randomUUID()}` },
		});
		const special = await created.json();
		const second = await (
			await request.post("/api/admin/create-special", {
				data: { title: `Replacement ${randomUUID()}` },
			})
		).json();
		try {
			await page.setViewportSize({ width, height: 900 });
			await page.goto("/admin/#shows");
			await page
				.getByRole("textbox", { name: "Search Shows" })
				.fill(show.title);
			const row = page.getByRole("row").filter({ hasText: show.title });
			const open = async () => {
				await row.getByRole("button", { name: "Edit", exact: true }).click();
				return page.getByRole("dialog", { name: "Edit Show", exact: true });
			};
			const form = await open();
			await form
				.getByRole("combobox", { name: "Search Special", exact: true })
				.fill(special.title);
			await form
				.getByRole("option", { name: special.title, exact: true })
				.click();
			await form
				.getByRole("button", { name: `Remove ${dj.title}`, exact: true })
				.click();
			await page.screenshot({ path: `/tmp/show-special-${width}.png` });
			await form.getByRole("button", { name: "Save", exact: true }).click();
			await expect(form).toBeHidden();
			await open();
			await expect(
				form.getByRole("button", {
					name: `Remove ${special.title}`,
					exact: true,
				}),
			).toBeVisible();
			await form
				.getByRole("combobox", { name: "Search Special", exact: true })
				.fill(second.title);
			await form
				.getByRole("option", { name: second.title, exact: true })
				.click();
			await expect(
				form.getByRole("button", {
					name: `Remove ${special.title}`,
					exact: true,
				}),
			).toHaveCount(0);
			await form
				.getByRole("button", { name: `Remove ${second.title}`, exact: true })
				.click();
			await form.getByRole("button", { name: "Save", exact: true }).click();
			await expect(form.getByRole("alert")).toContainText(
				"Select at least one DJ or a special",
			);
			await form
				.getByRole("combobox", { name: "Search DJs", exact: true })
				.fill(dj.title);
			await form.getByRole("option", { name: dj.title, exact: true }).click();
			await form.getByRole("button", { name: "Save", exact: true }).click();
			await expect(form).toBeHidden();
			const updated = (
				await (await request.get("/api/admin/shows")).json()
			).find((item: { id: number }) => item.id === show.id);
			expect(updated.special).toBeUndefined();
			expect(updated.djs).toEqual([dj.id]);
		} finally {
			await request.post("/api/admin/modify-show", {
				data: { ...showRequest(show), special_id: null },
			});
			for (const id of [special.id, second.id])
				await request.post("/api/admin/remove-special", { data: { id } });
		}
	});
}
