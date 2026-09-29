import type { ReactNode } from "react";
import styles from "./resource-grid.module.css";

type ResourceGridProps<Row> = {
	rows: Row[];
	rowKey: (row: Row) => string | number;
	renderCard: (row: Row, key: string | number) => ReactNode;
};

/** Provides the shared layout for resource-specific grid card scaffolds. */
export const ResourceGrid = <Row,>({
	rows,
	rowKey,
	renderCard,
}: ResourceGridProps<Row>) => (
	<div className={styles.grid}>
		{rows.map((row) => renderCard(row, rowKey(row)))}
	</div>
);
