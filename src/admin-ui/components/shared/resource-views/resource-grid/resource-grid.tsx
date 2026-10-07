import type { ReactNode } from "react";
import styles from "./resource-grid.module.css";

type ResourceGridProps<Row> = {
	rows: Row[];
	minimumColumnWidthRem?: number;
	rowKey: (row: Row) => string | number;
	renderCard: (row: Row, key: string | number) => ReactNode;
};

/** Provides the shared layout for resource-specific grid card scaffolds. */
export const ResourceGrid = <Row,>({
	rows,
	minimumColumnWidthRem = 16,
	rowKey,
	renderCard,
}: ResourceGridProps<Row>) => (
	<div
		className={styles.grid}
		style={{
			gridTemplateColumns: `repeat(auto-fill, minmax(min(${minimumColumnWidthRem}rem, 100%), 1fr))`,
		}}
	>
		{rows.map((row) => renderCard(row, rowKey(row)))}
	</div>
);
