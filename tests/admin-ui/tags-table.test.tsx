import { describe, expect, test } from "bun:test";
import { isValidElement } from "react";
import { Tag } from "../../src/admin-ui/components/shared/resource-views/index.js";
import {
	filterTags,
	ReviewedCell,
	TagsTable,
	tagColumns,
} from "../../src/admin-ui/components/tags/index.js";

describe("tags table", () => {
	test("routes the reviewed cell to its own mutation callback", () => {
		const onSave = async () => undefined;
		const tag = { id: 1, title: "Ambient", color: "#abcdef", reviewed: false };
		const table = TagsTable({
			tags: [tag],
			sortColumn: "id",
			sortDirection: "asc",
			onSort: () => undefined,
			onEdit: () => undefined,
			onReviewSave: onSave,
		});
		const cell = table.props.columns
			.find((column) => column.key === "reviewed")
			?.render(tag);
		expect(isValidElement(cell)).toBe(true);
		if (isValidElement<{ tag: typeof tag; onSave: typeof onSave }>(cell)) {
			expect(cell.type).toBe(ReviewedCell);
			expect(cell.props.tag).toBe(tag);
			expect(cell.props.onSave).toBe(onSave);
		}
	});
	test("renders the title as a colored tag chip", () => {
		const titleColumn = tagColumns.find(({ key }) => key === "title");
		const cell = titleColumn?.render({
			id: 1,
			title: "Ambient",
			color: "#abcdef",
			reviewed: true,
		});

		expect(isValidElement(cell)).toBe(true);
		expect(cell?.type).toBe(Tag);
		expect(cell?.props).toMatchObject({
			as: "span",
			color: "#abcdef",
			children: "Ambient",
		});
	});

	test("renders the reviewed and Mixcloud metadata columns", () => {
		const tag = {
			id: 1,
			title: "Ambient",
			color: "#abcdef",
			reviewed: true,
			mixcloud_key: "/genres/ambient/",
			mixcloud_url: "https://www.mixcloud.com/genres/ambient/",
		};

		expect(tagColumns.map(({ key }) => key)).toEqual([
			"id",
			"title",
			"color",
			"reviewed",
			"mixcloud_key",
			"mixcloud_url",
		]);
		expect(tagColumns.find(({ key }) => key === "reviewed")?.render(tag)).toBe(
			"true",
		);
		expect(
			tagColumns.find(({ key }) => key === "mixcloud_key")?.render(tag),
		).toBe("/genres/ambient/");
		expect(
			tagColumns.find(({ key }) => key === "mixcloud_url")?.render(tag),
		).toBe("https://www.mixcloud.com/genres/ambient/");
	});

	test("filters by title or color", () => {
		const tags = [
			{
				id: 1,
				title: "Ambient",
				color: "#abcdef",
				reviewed: true,
				mixcloud_key: "/genres/ambient/",
				mixcloud_url: "https://www.mixcloud.com/genres/ambient/",
			},
			{ id: 2, title: "Dance", color: "#123456", reviewed: false },
		];

		expect(filterTags(tags, "ambient")).toEqual([tags[0]]);
		expect(filterTags(tags, "123456")).toEqual([tags[1]]);
	});
});
