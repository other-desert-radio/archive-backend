import type { ModifyTagReviewRequest } from "../../../../admin/routes/tags/index.js";
import type { TagsAdminRow } from "../../../loaders/tags.js";
import {
	ResourceTable,
	type ResourceTableColumn,
	type SortDirection,
	Tag,
} from "../../shared/resource-views/index.js";
import { ReviewedCell } from "./reviewed-cell/index.js";

export type TagSortColumn =
	| "id"
	| "title"
	| "color"
	| "reviewed"
	| "mixcloud_key"
	| "mixcloud_url";

type TagsTableProps = {
	tags: TagsAdminRow[];
	sortColumn: TagSortColumn;
	sortDirection: SortDirection;
	onSort: (column: TagSortColumn) => void;
	onEdit: (tag: TagsAdminRow) => void;
	onReviewSave: (request: ModifyTagReviewRequest) => Promise<void>;
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
		render: (tag) => (
			<Tag as="span" color={tag.color}>
				{tag.title}
			</Tag>
		),
		compare: (left, right) => left.title.localeCompare(right.title),
	},
	{
		key: "color",
		label: "color",
		render: (tag) => tag.color,
		compare: (left, right) => left.color.localeCompare(right.color),
	},
	{
		key: "reviewed",
		label: "reviewed",
		render: (tag) => String(tag.reviewed),
		compare: (left, right) => Number(left.reviewed) - Number(right.reviewed),
	},
	{
		key: "mixcloud_key",
		label: "mixcloud key",
		render: (tag) => tag.mixcloud_key,
		compare: (left, right) =>
			(left.mixcloud_key ?? "").localeCompare(right.mixcloud_key ?? ""),
	},
	{
		key: "mixcloud_url",
		label: "mixcloud url",
		render: (tag) => tag.mixcloud_url,
		compare: (left, right) =>
			(left.mixcloud_url ?? "").localeCompare(right.mixcloud_url ?? ""),
	},
];

export const TagsTable = ({
	tags,
	sortColumn,
	sortDirection,
	onSort,
	onEdit,
	onReviewSave,
}: TagsTableProps) => (
	<ResourceTable
		rows={tags}
		rowKey={(tag) => tag.id}
		caption="Tags"
		columns={tagColumns.map((column) =>
			column.key === "reviewed"
				? {
						...column,
						render: (tag: TagsAdminRow) => (
							<ReviewedCell tag={tag} onSave={onReviewSave} />
						),
					}
				: column,
		)}
		sortColumn={sortColumn}
		sortDirection={sortDirection}
		onSort={onSort}
		onEdit={onEdit}
	/>
);
