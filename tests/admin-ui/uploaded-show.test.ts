import { expect, test } from "bun:test";
import {
	prepareUploadedShow,
	saveUploadedShow,
} from "../../src/admin-ui/loaders/uploaded-show.js";

const reviewed = {
	title: "Our title",
	description: "Our description",
	date: "2026-10-26",
	djs: [1],
};
const mixcloud = {
	key: "/odr/show/",
	url: "https://www.mixcloud.com/odr/show/",
	name: "Provider title",
	tags: [
		{
			key: "/genres/house/",
			name: "House",
			url: "https://www.mixcloud.com/genres/house/",
		},
	],
	created_time: "2026-10-26T12:00:00Z",
	updated_time: "2026-10-26T12:00:00Z",
	play_count: 0,
	pictures: {
		large: "https://images.test/small.jpg",
		"1024wx1024h": "https://images.test/large.jpg",
	},
	slug: "show",
	audio_length: 120,
};
const show = {
	id: 42,
	createdAt: "2026-10-26T12:00:00Z",
	date: "2026-10-26T00:00:00Z",
	title: "Saved title",
	description: "Saved description",
	duration: 120,
	image: mixcloud.pictures["1024wx1024h"],
	mixcloud_image_small: mixcloud.pictures.large,
	mixcloud_image_large: mixcloud.pictures["1024wx1024h"],
	url: mixcloud.url,
	djs: [1],
	tags: [2],
};

test("prepares the existing upload and validates review metadata", async () => {
	const review = { uploadId: 5, editorial: reviewed, mixcloud };
	expect(
		await prepareUploadedShow(5, async (url, init) => {
			expect(url).toBe("/api/admin/mixcloud/uploads/5/prepare");
			expect(init).toEqual({ method: "POST" });
			return Response.json(review);
		}),
	).toEqual(review);
});
for (const status of [200, 201])
	test(`save returns the persisted response for HTTP ${status}`, async () => {
		expect(
			await saveUploadedShow(5, reviewed, async (url, init) => {
				expect(url).toBe("/api/admin/mixcloud/uploads/5/save");
				expect(init?.method).toBe("POST");
				expect(JSON.parse(String(init?.body))).toEqual(reviewed);
				return Response.json({ show }, { status });
			}),
		).toEqual(show);
	});
for (const stage of ["prepare", "save"] as const) {
	const call = (fetcher: typeof fetch) =>
		stage === "prepare"
			? prepareUploadedShow(5, fetcher)
			: saveUploadedShow(5, reviewed, fetcher);
	test(`${stage} preserves readable server errors`, async () => {
		await expect(
			call(async () =>
				Response.json(
					{ error: "Please select an existing DJ" },
					{ status: 400 },
				),
			),
		).rejects.toThrow("Please select an existing DJ");
	});
	test(`${stage} handles network and unreadable responses without upload fallback`, async () => {
		let calls = 0;
		await expect(
			call(async () => {
				calls++;
				throw new Error("network");
			}),
		).rejects.toThrow(
			stage === "prepare" ? "unable to fetch the show" : "Retry Save",
		);
		expect(calls).toBe(1);
		for (const response of [
			new Response("unreadable"),
			Response.json({}),
			Response.json({ error: "failed" }, { status: 500 }),
		])
			await expect(call(async () => response)).rejects.toThrow();
	});
}
test("preparation failure shows one message and HTTP status without correction boilerplate", async () => {
	const message = "Uploaded to Mixcloud, but we were unable to fetch the show.";
	await expect(
		prepareUploadedShow(5, async () =>
			Response.json(
				{ error: message },
				{ status: 502, statusText: "Bad Gateway" },
			),
		),
	).rejects.toThrow(`${message}\n\nStatus: HTTP 502 (Bad Gateway)`);
});
test("rejects another upload's review and invalid provider fields", async () => {
	for (const body of [
		{ uploadId: 6, editorial: reviewed, mixcloud },
		{
			uploadId: 5,
			editorial: reviewed,
			mixcloud: { ...mixcloud, audio_length: 0 },
		},
	])
		await expect(
			prepareUploadedShow(5, async () => Response.json(body)),
		).rejects.toThrow("unreadable");
});
test("rejects incomplete saved Show data and accepts an omitted description", async () => {
	await expect(
		saveUploadedShow(5, reviewed, async () =>
			Response.json({ show: { id: 42 } }),
		),
	).rejects.toThrow("Retry Save");
	for (const field of ["date", "createdAt"])
		await expect(
			saveUploadedShow(5, reviewed, async () =>
				Response.json({ show: { ...show, [field]: "invalid-date" } }),
			),
		).rejects.toThrow("Retry Save");
	const { description: _description, ...withoutDescription } = show;
	expect(
		await saveUploadedShow(5, reviewed, async () =>
			Response.json({ show: withoutDescription }),
		),
	).toEqual(withoutDescription);
});
