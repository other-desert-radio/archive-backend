import type { CSSProperties, ReactNode } from "react";
import styles from "./resource-grid.module.css";

type ResourceGridProps<Row> = {
	rows: Row[];
	minimumColumnWidth?: string;
	rowKey: (row: Row) => string | number;
	renderCard: (row: Row, key: string | number) => ReactNode;
};

/** Provides the shared layout for resource-specific grid card scaffolds. */
export const ResourceGrid = <Row,>({
	rows,
	minimumColumnWidth,
	rowKey,
	renderCard,
}: ResourceGridProps<Row>) => (
	<div
		className={styles.grid}
		style={
			minimumColumnWidth === undefined
				? undefined
				: ({
						"--grid-minimum-column-width": minimumColumnWidth,
					} as CSSProperties)
		}
	>
		{rows.map((row) => renderCard(row, rowKey(row)))}
	</div>
);
