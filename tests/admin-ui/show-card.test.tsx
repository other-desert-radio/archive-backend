import { describe, expect, test } from "bun:test";
import { renderShowCard } from "../../src/admin-ui/components/shows/index.js";

describe("Show card", () => {
	test("renders the available image and tag titles", () => {
		const card = renderShowCard(
			{
				id: 1,
				createdAt: "2026-09-29T00:00:00.000Z",
				title: "Show One",
				date: "2026-09-29T00:00:00.000Z",
				image: "https://example.com/show.webp",
				duration: 3600,
				djs: [3],
				tags: [2],
				url: "https://example.com/show",
			},
			new Map([[2, { title: "Ambient", color: "#abcdef" }]]),
			new Map([[3, { title: "DJ One" }]]),
		);

		const [image, _title, djs, tags] = card.props.children;
		expect(image.props.src).toBe("https://example.com/show.webp");
		expect(image.props.alt).toBe("Show One");
		expect(djs.props.children).toBe("DJ One");
		expect(tags.props.children[0].props.children).toBe("Ambient");
	});

	test("renders image and tag fallbacks when metadata is unavailable", () => {
		const card = renderShowCard({
			id: 1,
			createdAt: "2026-09-29T00:00:00.000Z",
			title: "Show One",
			date: "2026-09-29T00:00:00.000Z",
			duration: 3600,
			djs: [],
			tags: [4],
			url: "https://example.com/show",
		});

		const [image, _title, djs, tags] = card.props.children;
		expect(image.props.children).toBe("No image");
		expect(djs.props.children).toBe("No DJs");
		expect(tags.props.children[0].props.children).toBe("Tag #4");
	});
});
