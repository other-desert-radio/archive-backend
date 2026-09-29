import { describe, expect, test } from "bun:test";
import { renderDJCard } from "../../src/admin-ui/components/dj/index.js";

describe("DJ card", () => {
	test("renders the available portrait and tag titles", () => {
		const card = renderDJCard(
			{
				id: 1,
				createdAt: "2026-09-29T00:00:00.000Z",
				title: "DJ One",
				bio: "Bio",
				image_small: "/small.webp",
				image_large: "/large.webp",
				shows: [],
				tags: [2],
			},
			new Map([[2, { title: "Ambient", color: "#abcdef" }]]),
		);

		const [image, _title, tags] = card.props.children;
		expect(image.props.src).toBe("/large.webp");
		expect(image.props.alt).toBe("DJ One");
		expect(tags.props.children[0].props.children).toBe("Ambient");
	});

	test("renders an image and tag fallback when metadata is unavailable", () => {
		const card = renderDJCard({
			id: 1,
			createdAt: "2026-09-29T00:00:00.000Z",
			title: "DJ One",
			bio: "Bio",
			shows: [],
			tags: [4],
		});

		const [image, _title, tags] = card.props.children;
		expect(image.props.children).toBe("No image");
		expect(tags.props.children[0].props.children).toBe("Tag #4");
	});
});
