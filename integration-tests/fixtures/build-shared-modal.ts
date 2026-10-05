import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { build } from "vite";

/** Bundles real shared components for interaction tests without adding an app route. */
export const buildSharedModalFixture = async () => {
	const directory = await mkdtemp(
		path.join(tmpdir(), "archive-modal-fixture-"),
	);
	await build({
		configFile: false,
		plugins: [react()],
		base: "/admin/__modal-test/",
		build: {
			outDir: directory,
			emptyOutDir: true,
			cssCodeSplit: false,
			rollupOptions: {
				input: path.resolve("integration-tests/fixtures/shared-modal.tsx"),
			},
		},
	});
	const assets = new Map<string, Buffer>();
	for (const name of await readdir(path.join(directory, "assets"))) {
		assets.set(
			`assets/${name}`,
			await readFile(path.join(directory, "assets", name)),
		);
	}
	const script = [...assets.keys()].find((name) => name.endsWith(".js"));
	const css = [...assets.keys()].find((name) => name.endsWith(".css"));
	const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/admin/__modal-test/${css}"></head><body><div id="root"></div><script type="module" src="/admin/__modal-test/${script}"></script></body></html>`;
	return { directory, assets, html };
};
