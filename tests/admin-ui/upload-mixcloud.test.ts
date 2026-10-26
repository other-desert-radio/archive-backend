import { expect, spyOn, test } from "bun:test";
import { uploadMixcloud } from "../../src/admin-ui/loaders/upload-mixcloud.js";

for (const status of [400, 413, 501]) {
	test(`upload loader sends metadata/audio and preserves failure for HTTP ${status}`, async () => {
		const fetcher = spyOn(globalThis, "fetch").mockImplementation(
			async (input, init) => {
				expect(input).toBe("/api/admin/mixcloud/upload");
				expect(init?.method).toBe("POST");
				const body = init?.body;
				expect(body).toBeInstanceOf(FormData);
				if (!(body instanceof FormData)) throw new Error("Expected multipart");
				expect(body.get("title")).toBe("Test");
				expect(body.get("date")).toBe("2026-10-26");
				expect(body.get("tags")).toBe('["House"]');
				expect(body.get("mp3")).toBeInstanceOf(File);
				return Response.json({ success: false }, { status });
			},
		);
		try {
			await expect(
				uploadMixcloud({
					title: "Test",
					date: "2026-10-26",
					tags: ["House"],
					mp3: new File(["audio"], "show.mp3"),
				}),
			).rejects.toThrow(
				status === 501
					? "validation completed"
					: status === 413
						? "exceeds"
						: "Upload failed",
			);
		} finally {
			fetcher.mockRestore();
		}
	});
}
