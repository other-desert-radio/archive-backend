import { expect, spyOn, test } from "bun:test";
import { uploadMixcloud } from "../../src/admin-ui/loaders/upload-mixcloud.js";

for (const status of [400, 413, 502]) {
	test(`upload loader sends metadata/audio and preserves failure for HTTP ${status}`, async () => {
		const fetcher = spyOn(globalThis, "fetch").mockImplementation(
			async (input, init) => {
				expect(input).toBe("/api/admin/mixcloud/upload");
				expect(init?.method).toBe("POST");
				const body = init?.body;
				expect(body).toBeInstanceOf(FormData);
				if (!(body instanceof FormData)) throw new Error("Expected multipart");
				expect(body.get("title")).toBe("Test");
				expect(body.get("mixcloud_title")).toBe("DJ - Test");
				expect(body.get("date")).toBe("2026-10-26");
				expect(body.get("djs")).toBe("[1]");
				expect(body.get("tags")).toBe('["House"]');
				expect(body.get("mp3")).toBeInstanceOf(File);
				expect(body.has("image")).toBe(false);
				return Response.json({ success: false }, { status });
			},
		);
		try {
			await expect(
				uploadMixcloud({
					title: "Test",
					mixcloud_title: "DJ - Test",
					date: "2026-10-26",
					djs: [1],
					tags: ["House"],
					mp3: new File(["audio"], "show.mp3"),
				}),
			).rejects.toThrow(
				status === 502
					? "Unable to confirm"
					: status === 413
						? "exceeds"
						: "Upload failed",
			);
		} finally {
			fetcher.mockRestore();
		}
	});
}

test("upload loader includes cropped WebP bytes and metadata", async () => {
	const image = new File(["cropped-webp"], "cover.webp", {
		type: "image/webp",
	});
	const fetcher = spyOn(globalThis, "fetch").mockImplementation(
		async (_input, init) => {
			const body = init?.body;
			if (!(body instanceof FormData)) throw new Error("Expected multipart");
			const received = body.get("image");
			if (!(received instanceof File)) throw new Error("Expected image");
			expect(received.name).toBe("cover.webp");
			expect(received.type).toBe("image/webp");
			expect(await received.text()).toBe("cropped-webp");
			expect(body.get("description")).toBe("Line one\nLine two");
			return Response.json({
				success: true,
				uploadId: 42,
				key: "/odr/show/",
				url: "https://www.mixcloud.com/odr/show/",
			});
		},
	);
	try {
		const result = await uploadMixcloud({
			title: "Show",
			mixcloud_title: "DJ - Show",
			date: "2026-10-26",
			djs: [1],
			tags: [],
			mp3: new File(["audio"], "show.mp3"),
			image,
			description: "Line one\nLine two",
		});
		expect(result.uploadId).toBe(42);
	} finally {
		fetcher.mockRestore();
	}
});

test("reports a confirmed provider upload when pending storage fails", async () => {
	const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(
		Response.json(
			{
				success: false,
				uploaded: true,
				key: "/odr/show/",
				url: "https://www.mixcloud.com/odr/show/",
			},
			{ status: 500 },
		),
	);
	try {
		await expect(
			uploadMixcloud({
				title: "Show",
				mixcloud_title: "DJ - Show",
				date: "2026-10-26",
				djs: [1],
				tags: [],
				mp3: new File(["audio"], "show.mp3"),
			}),
		).rejects.toThrow("Do not upload again");
	} finally {
		fetcher.mockRestore();
	}
});
