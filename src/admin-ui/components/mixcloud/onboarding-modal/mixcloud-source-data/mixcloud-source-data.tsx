import type { MixcloudImportAdminRow } from "../../../../loaders/mixcloud-imports.js";
import {
	formatDuration,
	formatMissing,
	formatUTCDateTime,
} from "../../../shared/resource-views/index.js";
import styles from "./mixcloud-source-data.module.css";

/** The import's read-only source section intentionally includes only approved fields. */
export const MixcloudSourceData = ({
	row,
}: {
	row: MixcloudImportAdminRow;
}) => {
	const values = [
		["name", formatMissing(row.name)],
		[
			"url",
			row.url && /^https?:\/\//i.test(row.url) ? (
				<a key="source-url" href={row.url} target="_blank" rel="noreferrer">
					{row.url}
				</a>
			) : (
				formatMissing(row.url)
			),
		],
		[
			"created_time",
			formatMissing(
				row.created_time === undefined
					? undefined
					: formatUTCDateTime(row.created_time),
			),
		],
		[
			"duration",
			formatMissing(
				row.duration === undefined ? undefined : formatDuration(row.duration),
			),
		],
		[
			"mixcloud_tag_json",
			formatMissing(
				row.mixcloud_tags?.length
					? JSON.stringify(row.mixcloud_tags)
					: undefined,
			),
		],
	] as const;
	return (
		<section
			className={styles.section}
			aria-labelledby={`mixcloud-source-${row.id}`}
		>
			<h3 id={`mixcloud-source-${row.id}`}>MIXCLOUD DATA</h3>
			<dl>
				{values.map(([label, value]) => (
					<div key={label}>
						<dt>{label}</dt>
						<dd>{label === "name" ? <strong>{value}</strong> : value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
};
