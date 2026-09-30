import { describe, expect, test } from "bun:test";
import { ResourceGrid } from "../../src/admin-ui/components/shared/resource-views/index.js";

describe("resource grid", () => {
	test("renders one resource-specific card scaffold for each row", () => {
		const rows = [{ id: 1 }, { id: 2 }];
		const renderedRows: Array<{ id: number; key: string | number }> = [];
		const grid = ResourceGrid({
			rows,
			rowKey: (row) => row.id,
			renderCard: (row, key) => {
				renderedRows.push({ id: row.id, key });
				return <div key={key} />;
			},
		});

		expect(renderedRows).toEqual([
			{ id: 1, key: 1 },
			{ id: 2, key: 2 },
		]);
		expect(grid.props.children).toHaveLength(2);
	});
});
