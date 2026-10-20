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
		await page.getByRole("button", { name: "Publish", exact: true }).click();
		await expect(page.getByRole("dialog")).toContainText("publish-dev");
		await expect(
			page.getByRole("button", { name: "Close", exact: true }),
		).toBeFocused();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: "Publish", exact: true })
			.click();
		await expect(page.getByRole("dialog")).toContainText(
			"Current stage: exporting",
		);
		await expect(page.getByRole("log")).toContainText("Exporting generated");
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
		page.getByRole("button", { name: "Publish", exact: true }),
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
	await page.getByRole("button", { name: "Retry", exact: true }).click();
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
		page.getByRole("button", { name: "Publish", exact: true }),
	).toHaveCount(0);
	await expect(page.getByLabel("email", { exact: true })).toBeFocused();
});
