import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MixcloudSourceData } from "../../src/admin-ui/components/mixcloud/index.js";
import {
	initialImportValues,
	resolveImportDJs,
} from "../../src/admin-ui/components/mixcloud/onboarding-modal/import-show-form/import-show-utils.js";
import { buildShowFormRequest } from "../../src/admin-ui/components/shows/index.js";
import type { MixcloudImportAdminRow } from "../../src/admin-ui/loaders/mixcloud-imports.js";

const row: MixcloudImportAdminRow = {
	id: 7,
	key: "/source/",
	data_changed: false,
	djs: [],
	dj_names: [],
	tags: [],
	name: "Source",
	derived_title: "Suggested",
	derived_date: "2026-10-01T00:30:00+02:00",
	duration: 3661,
	url: "https://example.test/source",
	image_small: "https://example.test/small",
	image_large: "https://example.test/large",
};
test("import initialization uses suggestions, UTC dates, and complete source URLs", () => {
	expect(initialImportValues(row)).toMatchObject({
		title: "Suggested",
		date: "2026-09-30",
		duration: "3661",
		url: row.url,
		image_small: row.image_small,
		image_large: row.image_large,
	});
	expect(
		initialImportValues({
			id: 8,
			key: "/missing/",
			data_changed: false,
			djs: [],
			dj_names: [],
			tags: [],
			name: "Fallback",
		}),
	).toMatchObject({
		title: "Fallback",
		date: "",
		duration: "",
		url: "",
		image_small: "",
		image_large: "",
	});
});
test("DJ names resolve only unique exact matches and deduplicate IDs", () => {
	expect(
		resolveImportDJs(
			[" Known ", "KNOWN", "Ambiguous", "Missing", " "],
			[
				{ id: 1, title: "known" },
				{ id: 2, title: "ambiguous" },
				{ id: 3, title: " Ambiguous " },
				{ id: 4, title: "Missing suffix" },
			],
		),
	).toEqual({ selected: [1], unmatched: ["Ambiguous", "Missing"] });
});
test("shared Show payload builder retains image variants, selected DJs and tag drafts", () => {
	expect(
		buildShowFormRequest({
			...initialImportValues(row),
			selected: [1],
			tags: ["Ambient"],
			tagDraft: "New",
		}),
	).toMatchObject({
		title: "Suggested",
		duration: 3661,
		image_small: row.image_small,
		image_large: row.image_large,
		djs: [1],
		tags: ["Ambient", "New"],
	});
	expect(() => buildShowFormRequest(initialImportValues(row))).toThrow(
		"Select at least one DJ",
	);
	expect(() =>
		buildShowFormRequest({
			...initialImportValues(row),
			selected: [1],
			image_large: "",
		}),
	).toThrow("Large image");
});
test("source section includes exactly the approved labels and renders missing values", () => {
	const markup = renderToStaticMarkup(
		<MixcloudSourceData
			row={{
				...row,
				created_time: "2026-10-01T02:03:04Z",
				mixcloud_tag_keys: [],
				parser_key: "hidden-parser",
				decoded_djs: ["hidden-dj"],
				imported_at: "hidden-date",
			}}
		/>,
	);
	expect(
		[...markup.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1]),
	).toEqual([
		"id",
		"name",
		"url",
		"key",
		"created_time",
		"duration",
		"mixcloud_tag_keys",
		"show_id",
	]);
	expect(markup).toContain("2026-10-01 02:03:04 UTC");
	expect(markup).toContain("01:01:01");
	expect(markup).toContain("None");
	for (const hidden of [
		"image_small",
		"image_large",
		"derived_title",
		"hidden-parser",
		"hidden-dj",
		"hidden-date",
	])
		expect(markup).not.toContain(hidden);
});
