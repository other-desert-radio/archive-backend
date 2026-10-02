import { expect, test } from "bun:test";
import { fetchMixcloud } from "../../src/admin/routes/mixcloud-imports/fetch-mixcloud.js";

const pictures = {
	small: "image",
	thumbnail: "image",
	medium_mobile: "image",
	medium: "image",
	large: "image",
	"320wx320h": "image",
	extra_large: "image",
	"640wx640h": "image",
	"768wx768h": "image",
	"1024wx1024h": "image",
};
const cloudcast = {
	key: "/one/",
	url: "https://www.mixcloud.com/one/",
	name: "Show",
	tags: [
		{
			key: "/genres/live/",
			url: "https://www.mixcloud.com/genres/live/",
			name: "Live",
		},
	],
	created_time: "2026-09-21T06:12:56Z",
	updated_time: "2026-09-30T17:36:46Z",
	play_count: 4,
	favorite_count: 0,
	comment_count: 0,
	listener_count: 1,
	repost_count: 0,
	pictures,
	slug: "one",
	user: {
		key: "/odr/",
		url: "https://www.mixcloud.com/odr/",
		name: "ODR",
		username: "odr",
		pictures,
	},
	hosts: [],
	audio_length: 10824,
};

test("combines all pages while preserving source records and applying per-page signals", async () => {
	const urls: string[] = [];
	const records = [
		{ ...cloudcast, extra: { preserved: true } },
		{ ...cloudcast, key: "/two/" },
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
					data: [cloudcast],
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

for (const [field, value] of Object.entries(cloudcast)) {
	for (const invalid of [
		undefined,
		typeof value === "string" ? 123 : "invalid",
	]) {
		test(`rejects missing or invalid cloudcast ${field}: ${String(invalid)}`, async () => {
			await expect(
				fetchMixcloud((async () =>
					Response.json({
						data: [{ ...cloudcast, [field]: invalid }],
					})) as typeof fetch),
			).rejects.toThrow("Invalid Mixcloud page");
		});
	}
}

for (const invalid of [
	null,
	{ ...cloudcast, tags: [{ key: "/genres/live/", url: 123, name: "Live" }] },
	{ ...cloudcast, pictures: { ...pictures, large: null } },
	{ ...cloudcast, user: { ...cloudcast.user, username: 123 } },
	{
		...cloudcast,
		user: { ...cloudcast.user, pictures: { ...pictures, small: null } },
	},
]) {
	test("rejects invalid cloudcasts and nested metadata", async () => {
		await expect(
			fetchMixcloud((async () =>
				Response.json({ data: [invalid] })) as typeof fetch),
		).rejects.toThrow("Invalid Mixcloud page");
	});
}
