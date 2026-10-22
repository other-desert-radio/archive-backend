import { expect, test } from "@playwright/test";
import type {
	PublicationJob,
	PublicationStatus,
} from "../src/publication/index.js";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:43827";
test.use({ baseURL, timezoneId: "America/Los_Angeles" });
const job: PublicationJob = {
	id: "test-job",
	requestedBy: "admin",
	createdAt: "2026-10-20T00:00:00Z",
	target: {
		mode: "remote",
		repository: "git@example.test:archive.git",
		checkoutPath: "/archive",
		branch: "publish-dev",
	},
	outcome: "running",
	stage: "exporting",
};
const initial: PublicationStatus = {
	mode: "remote",
	target: job.target,
	revision: "2",
	publishedRevision: "1",
	pending: true,
};
const readyPreview = {
	id: "preview-1",
	expiresAt: "2099-10-21T00:00:00Z",
	revision: "2",
	changes: {
		tags: {
			added: ["Ambient", "Live", "Desert"],
			changed: ["Electronic"],
			removed: ["Old tag"],
		},
		shows: { added: [], changed: ["Evening broadcast"], removed: [] },
		djs: { added: [], changed: [], removed: [] },
	},
};
for (const mode of ["remote", "local"] as const) {
	for (const width of [1440, 390, 320]) {
		test(`publication confirmation and durable reconnect in ${mode} mode at ${width}px`, async ({
			page,
		}) => {
			const activeJob: PublicationJob = {
				...job,
				target: { ...job.target, mode },
			};
			let status: PublicationStatus = {
				...initial,
				mode,
				target: activeJob.target,
			};
			let posts = 0;
			await page.setViewportSize({ width, height: 900 });
			await page.route("**/api/auth/get-session", (route) =>
				route.fulfill({
					json: {
						user: {
							id: "admin",
							email: "admin@example.test",
							role: "admin",
							mustChangePassword: false,
						},
					},
				}),
			);
			await page.route("**/api/admin/djs", (route) =>
				route.fulfill({ json: [] }),
			);
			await page.route("**/api/admin/tags", (route) =>
				route.fulfill({ json: [] }),
			);
			await page.route("**/api/admin/publication**", async (route) => {
				const path = new URL(route.request().url()).pathname;
				if (path.includes("/preview"))
					return route.fulfill({
						status: 200,
						json: readyPreview,
					});
				if (path.endsWith("/events"))
					return route.fulfill({
						contentType: "text/event-stream",
						body: `data: ${JSON.stringify({ type: "status", status })}\n\n`,
					});
				if (path.includes("/jobs/"))
					return route.fulfill({
						json: {
							job: status.latestJob,
							logs: [
								{
									sequence: 1,
									timestamp: activeJob.createdAt,
									message: "Exporting generated archive documents",
								},
							],
							logsTruncated: false,
						},
					});
				if (route.request().method() === "POST") {
					posts++;
					status = { ...status, latestJob: activeJob };
					return route.fulfill({ status: 202, json: activeJob });
				}
				return route.fulfill({ json: status });
			});
			await page.goto("/admin/#djs");
			await page
				.getByRole("button", { name: "publish changes", exact: true })
				.click();
			await expect(page.getByRole("dialog")).toContainText("publish-dev");
			await expect(page.getByRole("dialog")).toContainText(
				"changed Evening broadcast",
			);
			await expect(page.getByRole("dialog")).toContainText(
				"added Ambient, Live, Desert",
			);
			await expect(page.getByRole("dialog")).toContainText(
				"changed Electronic",
			);
			await expect(page.getByRole("dialog")).toContainText("removed Old tag");
			const pending = page.getByRole("region", {
				name: "Pending changes",
				exact: true,
			});
			await expect(
				pending.getByRole("heading", { name: "Pending changes", exact: true }),
			).toBeVisible();
			await expect(pending.locator("dt")).toHaveText(["Tags", "Shows"]);
			await expect(pending.locator("li")).toHaveText([
				"added Ambient, Live, Desert",
				"changed Electronic",
				"removed Old tag",
				"changed Evening broadcast",
			]);
			await expect(pending.locator("li strong")).toHaveText([
				"added",
				"changed",
				"removed",
				"changed",
			]);
			const layout = await pending.evaluate((element) => {
				const bounds = (selector: string) =>
					Array.from(element.querySelectorAll(selector)).map((node) => ({
						x: node.getBoundingClientRect().x,
						y: node.getBoundingClientRect().y,
						right: node.getBoundingClientRect().right,
					}));
				return {
					labels: bounds("dt"),
					values: bounds("dd"),
					overflow: element.scrollWidth > element.clientWidth,
				};
			});
			expect(layout.overflow).toBe(false);
			expect(layout.labels).toHaveLength(2);
			expect(layout.values).toHaveLength(2);
			expect(layout.labels[0]?.x).toBe(layout.labels[1]?.x);
			expect(layout.values[0]?.x).toBe(layout.values[1]?.x);
			for (let index = 0; index < layout.labels.length; index++) {
				expect(
					Math.abs(
						(layout.labels[index]?.y ?? 0) - (layout.values[index]?.y ?? 0),
					),
				).toBeLessThan(2);
				expect(layout.labels[index]?.right).toBeLessThan(
					layout.values[index]?.x ?? 0,
				);
				expect(layout.values[index]?.right).toBeLessThanOrEqual(width);
			}

			await page.screenshot({
				path: `/tmp/publication-preview-${mode}-${width}.png`,
			});
			if (mode === "local") {
				await expect(page.getByRole("dialog")).not.toContainText(
					"Write latest changes",
				);
				await expect(page.getByRole("dialog")).not.toContainText("Origin:");
			} else
				await expect(page.getByRole("dialog")).toContainText(
					"Publish latest changes to github.",
				);
			const publish = page.getByRole("dialog").getByRole("button", {
				name: "Publish",
				exact: true,
			});
			const close = page.getByRole("button", { name: "Close", exact: true });
			const panel = await page.getByRole("dialog").boundingBox();
			const action = await publish.boundingBox();
			const dismiss = await close.boundingBox();
			expect(
				Math.abs(
					(action?.x ?? 0) +
						(action?.width ?? 0) / 2 -
						((panel?.x ?? 0) + (panel?.width ?? 0) / 2),
				),
			).toBeLessThan(2);
			expect(dismiss?.y).toBeGreaterThan(
				(action?.y ?? 0) + (action?.height ?? 0),
			);
			await expect(close).toHaveCSS("border-top-width", "0px");
			await page.screenshot({
				path: `/tmp/publication-actions-${mode}-${width}.png`,
			});
			await page
				.getByRole("button", { name: "Close dialog", exact: true })
				.click();
			await expect(page.getByRole("dialog")).toHaveCount(0);
			await page
				.getByRole("button", { name: "publish changes", exact: true })
				.click();
			await expect(
				page.getByRole("button", { name: "Close", exact: true }),
			).toBeFocused();
			await page
				.getByRole("dialog")
				.getByRole("button", {
					name: "Publish",
					exact: true,
				})
				.click();
			await expect(page.getByRole("dialog")).toContainText(
				"Current stage: exporting",
			);
			await expect(page.locator('[role="log"]')).toBeHidden();
			const disclosure = page.locator("summary", {
				hasText: "Publication log",
			});
			await expect(disclosure).toHaveCSS("font-weight", "400");
			await disclosure.focus();
			await page.keyboard.press("Enter");
			await expect(page.getByRole("log")).toContainText("Exporting generated");
			const panelBounds = await page.getByRole("dialog").boundingBox();
			expect(panelBounds?.width).toBe(width === 1440 ? 864 : width - 32);
			await page.screenshot({
				path: `/tmp/publication-expanded-${mode}-${width}.png`,
			});
			await disclosure.click();
			await expect(page.locator('[role="log"]')).toBeHidden();
			await disclosure.click();
			await page.keyboard.press("Escape");
			await expect(page.getByRole("dialog")).toHaveCount(0);
			await page
				.getByRole("button", { name: "Publishing…", exact: true })
				.click();
			expect(posts).toBe(1);
			const bounds = await page.getByRole("dialog").boundingBox();
			expect(bounds?.x).toBeGreaterThanOrEqual(0);
			expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
				width,
			);
			await page.screenshot({ path: `/tmp/publication-${mode}-${width}.png` });
			await page.reload();
			await page
				.getByRole("button", { name: "Publishing…", exact: true })
				.click();
			expect(posts).toBe(1);
			status = {
				...status,
				pending: false,
				publishedRevision: "2",
				latestJob: {
					...activeJob,
					outcome: "succeeded",
					completedAt: "2026-10-20T20:30:00Z",
				},
			};
			await expect(page.getByRole("dialog")).toContainText(
				"Archive published",
				{
					timeout: 10000,
				},
			);
			await expect(page.getByRole("dialog")).toContainText(
				"Last published October 20 1:30 PM",
			);
			await page.screenshot({
				path: `/tmp/publication-last-published-${mode}-${width}.png`,
			});
			await expect(
				page.getByRole("button", { name: "Publishing…", exact: true }),
			).toHaveCount(0);
			await expect(
				page.getByRole("button", {
					name: mode === "local" ? "all changes saved" : "all changes pushed",
					exact: true,
				}),
			).toBeVisible();
		});
	}
}
test("editors do not request or expose publication", async ({ page }) => {
	let requests = 0;
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			json: {
				user: {
					id: "editor",
					email: "editor@example.test",
					role: "editor",
					mustChangePassword: false,
				},
			},
		}),
	);
	await page.route("**/api/admin/djs", (route) => route.fulfill({ json: [] }));
	await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }));
	await page.route("**/api/admin/publication**", (route) => {
		requests++;
		return route.abort();
	});
	await page.goto("/admin/#djs");
	await expect(
		page.getByRole("heading", { name: "DJs", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "publish changes", exact: true }),
	).toHaveCount(0);
	expect(requests).toBe(0);
});

test("failed publication requires an explicit retry and preserves failure logs", async ({
	page,
}) => {
	const failed: PublicationJob = {
		...job,
		outcome: "interrupted",
		completedAt: job.createdAt,
		error: "Backend restarted before completion",
	};
	let posts = 0;
	let reads = 0;
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			json: {
				user: {
					id: "admin",
					email: "admin@example.test",
					role: "admin",
					mustChangePassword: false,
				},
			},
		}),
	);
	await page.route("**/api/admin/djs", (route) => route.fulfill({ json: [] }));
	await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }));
	await page.route("**/api/admin/publication**", async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.includes("/preview"))
			return route.fulfill({
				status: 200,
				json: readyPreview,
			});
		if (path.endsWith("events")) return route.abort();
		if (path.includes("/jobs/"))
			return route.fulfill({
				json: {
					job: failed,
					logs: [
						{
							sequence: 3,
							timestamp: job.createdAt,
							message: "Push interrupted",
						},
					],
					logsTruncated: true,
				},
			});
		if (route.request().method() === "POST") {
			posts++;
			expect(route.request().postDataJSON()).toEqual({
				retryJobId: job.id,
				previewId: readyPreview.id,
			});
			return route.fulfill({
				status: 409,
				json: { error: "Another publication is running" },
			});
		}
		reads++;
		return route.fulfill({ json: { ...initial, latestJob: failed } });
	});
	await page.goto("/admin/#djs");
	await page
		.getByRole("button", { name: "publish changes", exact: true })
		.click();
	await expect(page.locator('[role="log"]')).toBeHidden();
	await page.locator("summary", { hasText: "Publication log" }).click();
	await expect(page.getByRole("log")).toContainText("Push interrupted");
	expect(posts).toBe(0);
	await page.getByRole("button", { name: "Publish", exact: true }).click();
	await expect(page.getByRole("dialog")).toContainText(
		"Another publication is running",
	);
	await expect(page.getByRole("log")).toContainText("Push interrupted");
	expect(posts).toBe(1);
	const previousReads = reads;
	await expect.poll(() => reads).toBeGreaterThan(previousReads);
	await expect(page.getByRole("dialog")).toContainText(
		"Another publication is running",
	);
});

test("an expired publication event session returns to sign in", async ({
	page,
}) => {
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			json: {
				user: {
					id: "admin",
					email: "admin@example.test",
					role: "admin",
					mustChangePassword: false,
				},
			},
		}),
	);
	await page.route("**/api/admin/djs", (route) => route.fulfill({ json: [] }));
	await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }));
	await page.route("**/api/admin/publication", (route) =>
		route.fulfill({ json: initial }),
	);
	await page.route("**/api/admin/publication/events", (route) =>
		route.fulfill({ status: 401, json: { error: "Unauthorized" } }),
	);
	await page.goto("/admin/#djs");
	await expect(
		page.getByRole("heading", { name: "Sign in", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "publish changes", exact: true }),
	).toHaveCount(0);
	await expect(page.getByLabel("email", { exact: true })).toBeFocused();
});

test("status failures keep the publish changes label", async ({ page }) => {
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			json: {
				user: {
					id: "admin",
					email: "admin@example.test",
					role: "admin",
					mustChangePassword: false,
				},
			},
		}),
	);
	await page.route("**/api/admin/djs", (route) => route.fulfill({ json: [] }));
	await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }));
	await page.route("**/api/admin/publication", (route) =>
		route.fulfill({ status: 500, json: { error: "Internal Server Error" } }),
	);
	await page.route("**/api/admin/publication/events", (route) => route.abort());
	await page.goto("/admin/#djs");
	await page
		.getByRole("button", { name: "publish changes", exact: true })
		.click();
	await expect(page.getByRole("dialog")).toContainText(
		"Could not load publication status (HTTP 500)",
	);
	await expect(
		page.getByRole("button", { name: "Reload status", exact: true }),
	).toBeVisible();
});

for (const mode of ["remote", "local"] as const) {
	test(`archive edits reveal publication control in ${mode} mode`, async ({
		page,
	}) => {
		let status = {
			...initial,
			mode,
			target: { ...initial.target, mode },
			revision: "1",
			publishedRevision: "1",
			pending: false,
			latestJob: {
				...job,
				outcome: "succeeded" as const,
				completedAt: job.createdAt,
			},
		};
		let posts = 0;
		await page.route("**/api/auth/get-session", (route) =>
			route.fulfill({
				json: {
					user: {
						id: "admin",
						email: "admin@example.test",
						role: "admin",
						mustChangePassword: false,
					},
				},
			}),
		);
		await page.route("**/api/admin/djs", (route) =>
			route.fulfill({ json: [] }),
		);
		await page.route("**/api/admin/tags", (route) =>
			route.fulfill({ json: [] }),
		);
		await page.route("**/api/admin/publication/events", (route) =>
			route.abort(),
		);
		await page.route("**/api/admin/publication/jobs/*", (route) =>
			route.fulfill({
				json: { job: status.latestJob, logs: [], logsTruncated: false },
			}),
		);
		await page.route("**/api/admin/publication/preview**", (route) =>
			route.fulfill({ status: 200, json: readyPreview }),
		);
		await page.route("**/api/admin/publication", (route) => {
			if (route.request().method() === "POST") posts++;
			return route.fulfill({ json: status });
		});
		await page.goto("/admin/#djs");
		await expect(
			page.getByRole("button", {
				name: mode === "local" ? "all changes saved" : "all changes pushed",
				exact: true,
			}),
		).toBeVisible();
		// A committed archive edit advances durable state; reconnect polling observes it.
		status = { ...status, revision: "2", pending: true };
		await page
			.getByRole("button", { name: "publish changes", exact: true })
			.click();
		await expect(page.getByRole("dialog")).not.toContainText(
			"Result: succeeded",
		);
		if (mode === "local") {
			await expect(page.getByRole("dialog")).not.toContainText(
				"Write latest changes",
			);
			await expect(page.getByRole("dialog")).not.toContainText("Origin:");
		} else
			await expect(page.getByRole("dialog")).toContainText(
				"Publish latest changes to github.",
			);
		await expect(
			page.getByRole("dialog").getByRole("button", {
				name: "Publish",
				exact: true,
			}),
		).toBeEnabled();
		if (mode === "local")
			await expect(page.getByRole("dialog")).toContainText("/archive");

		expect(posts).toBe(0);
	});
}

for (const width of [1440, 390, 320]) {
	test(`retry logs remain separated after reload at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.route("**/api/auth/get-session", (route) =>
			route.fulfill({
				json: {
					user: {
						id: "admin",
						email: "admin@example.test",
						role: "admin",
						mustChangePassword: false,
					},
				},
			}),
		);
		await page.route("**/api/admin/djs", (route) =>
			route.fulfill({ json: [] }),
		);
		await page.route("**/api/admin/tags", (route) =>
			route.fulfill({ json: [] }),
		);
		const retry = { ...job, id: "retry-job", retryJobId: job.id };
		await page.route("**/api/admin/publication**", async (route) => {
			const path = new URL(route.request().url()).pathname;
			if (path.includes("/preview"))
				return route.fulfill({
					status: 200,
					json: readyPreview,
				});
			if (path.endsWith("/events")) return route.abort();
			if (path.endsWith("/jobs/pruned"))
				return route.fulfill({ status: 404, json: { error: "Not Found" } });
			if (path.includes("/jobs/")) {
				const previous = path.endsWith(`/${job.id}`);
				return route.fulfill({
					json: {
						job: previous
							? {
									...job,
									outcome: "failed",
									completedAt: job.createdAt,
									retryJobId: "pruned",
								}
							: retry,
						logs: [
							{
								sequence: 1,
								timestamp: job.createdAt,
								message: previous
									? "First attempt failed"
									: "Second attempt uploading",
							},
						],
						logsTruncated: false,
					},
				});
			}
			return route.fulfill({ json: { ...initial, latestJob: retry } });
		});
		for (const reload of [false, true]) {
			if (reload) await page.reload();
			else await page.goto("/admin/#djs");
			await page
				.getByRole("button", { name: "Publishing…", exact: true })
				.click();
			await page.locator("summary", { hasText: "Publication log" }).click();
			const log = page.getByRole("log");
			await expect(log).toContainText("First attempt failed");
			await expect(log).toContainText("Second attempt uploading");
			await expect(log.locator("br")).toHaveCount(1);
			await expect(log.locator("p").first()).toContainText(
				"First attempt failed",
			);
		}
		await page.screenshot({ path: `/tmp/publication-attempts-${width}.png` });
	});
}

for (const mode of ["remote", "local"] as const) {
	test(`${mode} preview waits for preparation and requires refresh after a stale submit`, async ({
		page,
	}) => {
		let finishPreparation: () => void = () => {};
		const preparation = new Promise<void>((resolve) => {
			finishPreparation = resolve;
		});
		let previews = 0;
		let publications = 0;
		await page.route("**/api/auth/get-session", (route) =>
			route.fulfill({
				json: {
					user: {
						id: "admin",
						email: "admin@example.test",
						role: "admin",
						mustChangePassword: false,
					},
				},
			}),
		);
		await page.route("**/api/admin/djs", (route) =>
			route.fulfill({ json: [] }),
		);
		await page.route("**/api/admin/tags", (route) =>
			route.fulfill({ json: [] }),
		);
		await page.route("**/api/admin/publication**", async (route) => {
			const path = new URL(route.request().url()).pathname;
			if (path.endsWith("/events")) return route.abort();
			if (path.endsWith("/preview")) {
				previews++;
				expect(route.request().method()).toBe("POST");
				await preparation;
				return route.fulfill({ status: 200, json: readyPreview });
			}
			if (path.includes("/preview/"))
				throw new Error("Preview must not poll the server");
			if (route.request().method() === "POST") {
				publications++;
				expect(route.request().postDataJSON()).toEqual({
					previewId: readyPreview.id,
				});
				return route.fulfill({
					status: 409,
					json: { error: "Archive data changed. Refresh the preview." },
				});
			}
			return route.fulfill({
				json: { ...initial, mode, target: { ...initial.target, mode } },
			});
		});
		await page.goto("/admin/#djs");
		await page
			.getByRole("button", { name: "publish changes", exact: true })
			.click();
		const submit = page.getByRole("button", {
			name: "Publish",
			exact: true,
		});
		await expect(page.getByRole("dialog")).toContainText("Preparing changes…");
		await expect(submit).toBeDisabled();
		finishPreparation();
		await expect(submit).toBeEnabled();
		await expect(page.getByRole("dialog")).toContainText(
			"changed Evening broadcast",
		);
		const preparedCount = previews;
		await submit.click();
		await expect(page.getByRole("dialog")).toContainText(
			"Archive data changed",
		);
		await expect(submit).toBeDisabled();
		expect(publications).toBe(1);
		expect(previews).toBe(preparedCount);
		await page
			.getByRole("button", { name: "Refresh preview", exact: true })
			.click();
		await expect(submit).toBeEnabled();
		expect(previews).toBe(preparedCount + 1);
		expect(publications).toBe(1);
	});
}

for (const viewport of [
	{ width: 1440, height: 900 },
	{ width: 390, height: 844 },
	{ width: 320, height: 568 },
]) {
	test(`large pending changes scroll inside the list at ${viewport.width}px`, async ({
		page,
	}) => {
		await page.setViewportSize(viewport);
		await page.route("**/api/auth/get-session", (route) =>
			route.fulfill({
				json: {
					user: {
						id: "admin",
						email: "admin@example.test",
						role: "admin",
						mustChangePassword: false,
					},
				},
			}),
		);
		await page.route("**/api/admin/djs", (route) =>
			route.fulfill({ json: [] }),
		);
		await page.route("**/api/admin/tags", (route) =>
			route.fulfill({ json: [] }),
		);
		const status = {
			...initial,
			mode: "local",
			target: { ...initial.target, mode: "local" },
		};
		await page.addInitScript((status) => {
			const originalFetch = window.fetch;
			window.fetch = (input, init) => {
				if (String(input).endsWith("/api/admin/publication/events"))
					return Promise.resolve(
						new Response(
							new ReadableStream({
								start(controller) {
									controller.enqueue(
										new TextEncoder().encode(
											`data: ${JSON.stringify({ type: "status", status })}\n\n`,
										),
									);
								},
							}),
							{ headers: { "Content-Type": "text/event-stream" } },
						),
					);
				return originalFetch(input, init);
			};
		}, status);
		const names = Array.from(
			{ length: 200 },
			(_, index) => `Evening broadcast ${index + 1}`,
		);
		await page.route("**/api/admin/publication", (route) =>
			route.fulfill({ json: status }),
		);
		await page.route("**/api/admin/publication/preview", (route) =>
			route.fulfill({
				json: {
					...readyPreview,
					changes: {
						tags: { added: names, changed: [], removed: [] },
						shows: { added: [], changed: names, removed: [] },
						djs: { added: [], changed: [], removed: names },
					},
				},
			}),
		);
		await page.goto("/admin/#djs");
		await page
			.getByRole("button", { name: "publish changes", exact: true })
			.click();
		const list = page.getByRole("region", {
			name: "Pending changes list",
			exact: true,
		});
		const dialog = page.getByRole("dialog");
		await expect(list).toContainText("Evening broadcast 200");
		const dimensions = await list.evaluate((element) => ({
			scrollHeight: element.scrollHeight,
			height: element.clientHeight,
			overflow: element.scrollWidth > element.clientWidth,
		}));
		expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.height);
		expect(dimensions.height).toBeGreaterThan(0);
		expect(dimensions.overflow).toBe(false);
		await list.hover();
		await page.mouse.wheel(0, 400);
		await expect
			.poll(() => list.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(0);
		await list.evaluate((element) => {
			element.scrollTop = 0;
		});
		await list.focus();
		await page.keyboard.press("PageDown");
		await expect
			.poll(() => list.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(0);
		const panel = await dialog.evaluate((element) => ({
			scroll: element.scrollTop,
			scrollHeight: element.scrollHeight,
			height: element.clientHeight,
			overflow: element.scrollWidth > element.clientWidth,
		}));
		expect(panel.scroll).toBe(0);
		expect(panel.scrollHeight).toBeLessThanOrEqual(panel.height);
		expect(panel.overflow).toBe(false);
		for (const name of ["Publish", "Close"]) {
			const action = dialog.getByRole("button", { name, exact: true });
			await expect(action).toBeVisible();
			const bounds = await action.boundingBox();
			expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(
				viewport.height,
			);
		}
		await page.screenshot({
			path: `/tmp/publication-large-list-${viewport.width}.png`,
		});
	});
}
