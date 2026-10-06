import type { MixcloudImportAdminRow } from "../../src/admin-ui/loaders/mixcloud-imports.js";
export const importRows: MixcloudImportAdminRow[] = [
	{
		id: 7,
		key: "/otherdesertradio/source/",
		data_changed: false,
		djs: [],
		dj_names: [],
		tags: [],
		name: "Source title",
		derived_title: "Suggested title",
		derived_date: "2026-10-01T00:00:00Z",
		created_time: "2026-09-21T06:12:56Z",
		duration: 3661,
		url: `https://www.mixcloud.com/otherdesertradio/${"long-source-url-".repeat(12)}`,
		image_small: "https://example.test/small",
		image_large: "https://example.test/large",
		decoded_djs: [" known dj ", "Missing DJ", "Ambiguous DJ"],
		mixcloud_tags: [
			{
				key: "/genres/ambient/",
				name: "AMBIENT",
				url: "https://www.mixcloud.com/genres/ambient/",
			},
			{
				key: "/genres/unresolved/",
				name: "New Genre",
				url: "https://www.mixcloud.com/genres/unresolved/",
			},
			{
				key: "/genres/new-genre/",
				name: "MiXeD Genre",
				url: "https://www.mixcloud.com/genres/new-genre/",
			},
		],
	},
	{
		id: 8,
		key: "/otherdesertradio/second/",
		data_changed: false,
		djs: [],
		dj_names: [],
		tags: [],
		name: "Second source",
		url: "https://example.test/second",
		image_small: "https://example.test/second-small",
		image_large: "https://example.test/second-large",
		decoded_djs: ["Second DJ"],
		mixcloud_tags: [],
	},
];
export const fixtureDJs = [
	{ id: 1, title: "Known DJ", bio: "", tags: [], shows: [] },
	{ id: 2, title: "Ambiguous DJ", bio: "", tags: [], shows: [] },
	{ id: 3, title: "ambiguous dj", bio: "", tags: [], shows: [] },
	{ id: 4, title: "Second DJ", bio: "", tags: [], shows: [] },
];
export const fixtureTags = [
	{ id: 10, title: "Ambient", color: "#aabbcc", reviewed: true },
];
export const resolvedTags = {
	valid: [{ key: "/genres/ambient/", tag: fixtureTags[0] }],
	invalid: ["/genres/unresolved/"],
};
