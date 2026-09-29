import { describe, expect, test } from "bun:test";
import { ResourceGrid } from "../../src/admin-ui/components/shared/resource-views/resource-grid/resource-grid.js";

describe("resource grid", () => {
	test("renders one resource-specific card scaffold for each row", () => {
		const rows = [{ id: 1 }, { id: 2 }];
		const renderedRows: number[] = [];
		const grid = ResourceGrid({
			rows,
			rowKey: (row) => row.id,
			renderCard: (row) => {
				renderedRows.push(row.id);
				return <div />;
			},
		});

		expect(renderedRows).toEqual([1, 2]);
		expect(grid.props.children).toHaveLength(2);
	});
});
