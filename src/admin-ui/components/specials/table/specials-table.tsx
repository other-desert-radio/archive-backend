import type { SpecialsAdminRow } from "../../../loaders/specials.js";
import {
	ResourceTable,
	type ResourceTableColumn,
	type SortDirection,
} from "../../shared/resource-views/index.js";
import type { SpecialSortColumn } from "./specials-table-utils.js";
export const specialColumns: ResourceTableColumn<
	SpecialsAdminRow,
	SpecialSortColumn
>[] = [
	{
		key: "id",
		label: "id",
		render: (row) => row.id,
		compare: (a, b) => a.id - b.id,
	},
	{
		key: "title",
		label: "name",
		render: (row) => row.title,
		compare: (a, b) => a.title.localeCompare(b.title),
	},
	{
		key: "shows",
		label: "shows",
		render: (row) => (row.showTitles?.length ? row.showTitles.join(", ") : "-"),
		compare: (a, b) =>
			(a.showTitles ?? [])
				.join(", ")
				.localeCompare((b.showTitles ?? []).join(", ")),
	},
];
type Props = {
	specials: SpecialsAdminRow[];
	sortColumn: SpecialSortColumn;
	sortDirection: SortDirection;
	onSort: (column: SpecialSortColumn) => void;
	onEdit: (special: SpecialsAdminRow) => void;
	onDelete: (row: SpecialsAdminRow) => void;
};
export const SpecialsTable = ({ specials, onEdit, ...props }: Props) => (
	<ResourceTable
		rows={specials}
		rowKey={(row) => row.id}
		caption="Specials"
		columns={specialColumns}
		{...props}
		rowAction={{
			label: "Edit",
			onClick: onEdit,
			isVisible: () => true,
		}}
	/>
);
