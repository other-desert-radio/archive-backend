import { expect, test } from "bun:test";
import { fetchMixcloud } from "../../src/admin/routes/mixcloud-imports/fetch-mixcloud.js";

test("combines all pages while preserving source records and applying per-page signals", async () => {
	const urls: string[] = [];
	const records = [
		{ key: "/one/", extra: { preserved: true } },
		{ key: "/two/" },
	];
	const fetcher = (async (url, options) => {
		urls.push(String(url));
		expect(options?.signal).toBeInstanceOf(AbortSignal);
		return Response.json(
			urls.length === 1
				? {
						data: [records[0]],
						paging: { next: "https://api.mixcloud.com/next" },
					}
				: { data: [records[1]] },
		);
	}) as typeof fetch;
	expect(await fetchMixcloud(fetcher)).toEqual({ data: records });
	expect(urls).toEqual([
		"https://api.mixcloud.com/otherdesertradio/cloudcasts/?limit=100&offset=0",
		"https://api.mixcloud.com/next",
	]);
});

test("accepts an empty final page", async () => {
	expect(
		await fetchMixcloud((async () =>
			Response.json({ data: [], paging: { next: null } })) as typeof fetch),
	).toEqual({ data: [] });
});

for (const failure of [
	"http",
	"json",
	"envelope",
	"timeout",
	"loop",
] as const) {
	test(`stops on ${failure} without retries or a partial result`, async () => {
		let calls = 0;
		const fetcher = (async () => {
			calls++;
			if (calls === 1)
				return Response.json({
					data: [{ key: "/one/" }],
					paging: { next: "https://api.mixcloud.com/next" },
				});
			switch (failure) {
				case "http":
					return new Response("offline", { status: 503 });
				case "json":
					return new Response("invalid JSON");
				case "envelope":
					return Response.json({ data: "invalid" });
				case "timeout":
					throw new DOMException("Timed out", "TimeoutError");
				case "loop":
					return Response.json({
						data: [],
						paging: { next: "https://api.mixcloud.com/next" },
					});
			}
		}) as typeof fetch;
		await expect(fetchMixcloud(fetcher)).rejects.toThrow();
		expect(calls).toBe(2);
	});
}
