import { expect, test } from "@playwright/test";

test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});

test("floating navigation expands without moving its links", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto("/admin/#djs");
	await page.evaluate(() => document.fonts.ready);
	const sidebar = page.getByRole("complementary", { name: "Admin navigation" });
	const link = sidebar.getByRole("link", { name: "- DJs" });
	const original = await link.boundingBox();
	const restingHeight = await sidebar.evaluate(
		(element) => element.getBoundingClientRect().height,
	);
	const padding = await sidebar.evaluate((element) => {
		const pane = element.getBoundingClientRect();
		const nav = element.querySelector("nav")?.getBoundingClientRect();
		if (!nav) throw new Error("Navigation missing");
		return { top: nav.top - pane.top, bottom: pane.bottom - nav.bottom };
	});
	expect(padding.top).toBeCloseTo(padding.bottom, 5);
	const background = () =>
		sidebar.evaluate((element) => {
			const style = getComputedStyle(element, "::before");
			const rect = element.getBoundingClientRect();
			return {
				left: rect.left + parseFloat(style.left),
				top: rect.top + parseFloat(style.top),
				height: parseFloat(style.height),
				transition: style.transitionDuration,
			};
		});
	await expect
		.poll(async () => (await background()).height)
		.toBeCloseTo(restingHeight, 2);
	await sidebar.hover();
	await link.click();
	await expect.poll(async () => (await background()).height).toBe(800);
	expect((await background()).left).toBeCloseTo(0, 1);
	expect((await background()).top).toBeCloseTo(0, 1);
	expect(await link.boundingBox()).toEqual(original);
	await page.mouse.move(1000, 600);
	await expect
		.poll(async () => (await background()).height)
		.toBeCloseTo(restingHeight, 2);
	expect(await link.boundingBox()).toEqual(original);
	await page.keyboard.press("Tab");
	await page.keyboard.press("Shift+Tab");
	await expect.poll(async () => (await background()).height).toBe(800);
	expect(await link.boundingBox()).toEqual(original);
	await page.emulateMedia({ reducedMotion: "reduce" });
	expect((await background()).transition).toBe("0s");
	await page.setViewportSize({ width: 390, height: 844 });
	const phoneHeight = await sidebar.evaluate(
		(element) => element.getBoundingClientRect().height,
	);
	expect((await sidebar.boundingBox())?.height).toBeLessThan(220);
	await expect
		.poll(async () => (await background()).height)
		.toBeCloseTo(phoneHeight, 2);
	expect(
		await sidebar.evaluate((element) => getComputedStyle(element).position),
	).toBe("relative");
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
		390,
	);
});
