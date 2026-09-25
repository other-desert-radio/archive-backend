import type { TagsAdminRow } from "../../loaders/tags.js";
import {
	ResourceTable,
	type ResourceTableColumn,
	type SortDirection,
} from "../shared/resource-table.js";

export type TagSortColumn = "id" | "title" | "color";

type TagsTableProps = {
	tags: TagsAdminRow[];
	sortColumn: TagSortColumn;
	sortDirection: SortDirection;
	onSort: (column: TagSortColumn) => void;
};

export const tagColumns: ResourceTableColumn<TagsAdminRow, TagSortColumn>[] = [
	{
		key: "id",
		label: "id",
		render: (tag) => tag.id,
		compare: (left, right) => left.id - right.id,
	},
	{
		key: "title",
		label: "title",
		render: (tag) => tag.title,
		compare: (left, right) => left.title.localeCompare(right.title),
	},
	{
		key: "color",
		label: "color",
		render: (tag) => tag.color,
		compare: (left, right) => left.color.localeCompare(right.color),
	},
];

export const TagsTable = ({
	tags,
	sortColumn,
	sortDirection,
	onSort,
}: TagsTableProps) => (
	<ResourceTable
		rows={tags}
		rowKey={(tag) => tag.id}
		caption="Tags"
		columns={tagColumns}
		sortColumn={sortColumn}
		sortDirection={sortDirection}
		onSort={onSort}
	/>
);
