import { describe, expect, test } from "bun:test";
import { renderShowCard } from "../../src/admin-ui/components/shows/index.js";
import type { ShowsAdminRow } from "../../src/admin-ui/loaders/shows.js";

describe("Show card", () => {
	test("renders the available image and tag titles", () => {
		let editedShow: ShowsAdminRow | undefined;
		let deletedShow: ShowsAdminRow | undefined;
		const card = renderShowCard(
			{
				id: 1,
				createdAt: "2026-09-29T00:00:00.000Z",
				title: "Show One",
				description: "A late night journey",
				date: "2026-09-29T00:00:00.000Z",
				image: "https://example.com/show.webp",
				duration: 3600,
				djs: [3],
				tags: [2],
				url: "https://example.com/show",
			},
			new Map([[2, { title: "Ambient", color: "#abcdef" }]]),
			new Map([[3, { title: "DJ One" }]]),
			1,
			(show) => {
				editedShow = show;
			},
			(show) => {
				deletedShow = show;
			},
		);

		const [image, _title, djs, tags, description, actions] =
			card.props.children;
		expect(description.props.children.props.html).toBe("A late night journey");
		expect(image.props.src).toBe("https://example.com/show.webp");
		expect(image.props.alt).toBe("Show One");
		expect(djs.props.children).toBe("DJ One");
		expect(tags.props.children[0].props.children).toBe("Ambient");
		actions.props.children[0].props.onClick();
		actions.props.children[1].props.onClick();
		expect(deletedShow?.id).toBe(1);
		expect(editedShow?.id).toBe(1);
	});

	test("renders image and tag fallbacks when metadata is unavailable", () => {
		const card = renderShowCard(
			{
				id: 1,
				createdAt: "2026-09-29T00:00:00.000Z",
				title: "Show One",
				date: "2026-09-29T00:00:00.000Z",
				duration: 3600,
				djs: [],
				tags: [4],
				url: "https://example.com/show",
			},
			new Map(),
			new Map(),
			1,
			() => undefined,
		);

		const [image, _title, djs, tags, description] = card.props.children;
		expect(description).toBeUndefined();
		expect(image.props.children).toBe("No image");
		expect(djs.props.children).toBe("No DJs");
		expect(tags.props.children[0].props.children).toBe("Tag #4");
	});
});

test("special-only cards name the Special, while cards with DJs retain their names", () => {
	const show = {
		id: 1,
		createdAt: "2026-09-29Z",
		title: "Special show",
		date: "2026-09-29Z",
		duration: 60,
		djs: [],
		tags: [],
		url: "https://example.test/show",
		special: { id: 7, title: "Festival" },
	};
	const card = renderShowCard(show, new Map(), new Map(), 1, () => {});
	expect(card.props.children[2].props.children).toBe("Special: Festival");
	const withDJ = renderShowCard(
		{ ...show, djs: [3] },
		new Map(),
		new Map([[3, { title: "Guest DJ" }]]),
		1,
		() => {},
	);
	expect(withDJ.props.children[2].props.children).toBe("Guest DJ");
});
