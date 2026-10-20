import { expect, test } from "@playwright/test";
import type {
	PublicationJob,
	PublicationStatus,
} from "../src/publication/index.js";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:43827";
test.use({ baseURL });
const job: PublicationJob = {
	id: "test-job",
	requestedBy: "admin",
	createdAt: "2026-10-20T00:00:00Z",
	target: {
		repository: "git@example.test:archive.git",
		checkoutPath: "/archive",
		branch: "publish-dev",
	},
	outcome: "running",
	stage: "exporting",
};
const initial: PublicationStatus = {
	enabled: true,
	branch: "publish-dev",
	revision: "2",
	publishedRevision: "1",
	pending: true,
};
for (const width of [1440, 390, 320]) {
	test(`publication confirmation and durable reconnect at ${width}px`, async ({
		page,
	}) => {
		let status = { ...initial };
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
								timestamp: job.createdAt,
								message: "Exporting generated archive documents",
							},
						],
						logsTruncated: false,
					},
				});
			if (route.request().method() === "POST") {
				posts++;
				status = { ...status, latestJob: job };
				return route.fulfill({ status: 202, json: job });
			}
			return route.fulfill({ json: status });
		});
		await page.goto("/admin/#djs");
		await page
			.getByRole("button", { name: "publish changes", exact: true })
			.click();
		await expect(page.getByRole("dialog")).toContainText("publish-dev");
		await expect(page.getByRole("dialog")).toContainText(
			"Publish latest changes to github.",
		);
		const publish = page
			.getByRole("dialog")
			.getByRole("button", { name: "publish changes", exact: true });
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
		await page.screenshot({ path: `/tmp/publication-actions-${width}.png` });
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
			.getByRole("button", { name: "publish changes", exact: true })
			.click();
		await expect(page.getByRole("dialog")).toContainText(
			"Current stage: exporting",
		);
		await expect(page.locator('[role="log"]')).toBeHidden();
		const disclosure = page.locator("summary", { hasText: "Publication log" });
		await disclosure.focus();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("log")).toContainText("Exporting generated");
		const panelBounds = await page.getByRole("dialog").boundingBox();
		expect(panelBounds?.width).toBe(width === 1440 ? 864 : width - 32);
		await page.screenshot({ path: `/tmp/publication-expanded-${width}.png` });
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
		expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
		await page.screenshot({ path: `/tmp/publication-${width}.png` });
		await page.reload();
		await page
			.getByRole("button", { name: "Publishing…", exact: true })
			.click();
		expect(posts).toBe(1);
		status = {
			...status,
			pending: false,
			publishedRevision: "2",
			latestJob: { ...job, outcome: "succeeded", completedAt: job.createdAt },
		};
		await expect(page.getByRole("dialog")).toContainText("Archive published", {
			timeout: 10000,
		});
		await expect(
			page.getByRole("button", { name: "Publishing…", exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "all changes pushed", exact: true }),
		).toBeVisible();
	});
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
			expect(route.request().postDataJSON()).toEqual({ retryJobId: job.id });
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
	await page
		.getByRole("button", { name: "Retry publication", exact: true })
		.click();
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

for (const enabled of [true, false]) {
	test(`archive edits reveal publication control when enabled=${enabled}`, async ({
		page,
	}) => {
		let status = {
			...initial,
			enabled,
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
		await page.route("**/api/admin/publication", (route) => {
			if (route.request().method() === "POST") posts++;
			return route.fulfill({ json: status });
		});
		await page.goto("/admin/#djs");
		await expect(
			page.getByRole("button", { name: "all changes pushed", exact: true }),
		).toBeVisible();
		// A committed archive edit advances durable state; reconnect polling observes it.
		status = { ...status, revision: "2", pending: true };
		await page
			.getByRole("button", { name: "publish changes", exact: true })
			.click();
		await expect(page.getByRole("dialog")).not.toContainText(
			"Result: succeeded",
		);
		if (enabled) {
			await expect(page.getByRole("dialog")).toContainText(
				"Publish latest changes to github.",
			);
			await expect(
				page
					.getByRole("dialog")
					.getByRole("button", { name: "publish changes", exact: true }),
			).toBeEnabled();
		} else {
			await expect(page.getByRole("dialog")).toContainText(
				"Publishing is disabled",
			);
			await expect(page.getByRole("dialog")).toContainText(
				"ARCHIVE_PUBLISH_ENABLED=true",
			);
			await expect(
				page
					.getByRole("dialog")
					.getByRole("button", { name: "publish changes", exact: true }),
			).toHaveCount(0);
		}
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
		await page.route("**/api/admin/publication**", (route) => {
			const path = new URL(route.request().url()).pathname;
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
