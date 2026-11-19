import { useState } from "react";
import type { MixcloudImportAdminRow } from "../../../../loaders/mixcloud-imports.js";
import {
	formatDuration,
	formatMissing,
} from "../../../shared/resource-views/index.js";
import styles from "./mixcloud-source-data.module.css";

const triangleIcon = new URL(
	"../../../../assets/icons/triangle.svg",
	import.meta.url,
).href;

/** The import's read-only source section intentionally includes only approved fields. */
export const MixcloudSourceData = ({
	row,
}: {
	row: MixcloudImportAdminRow;
}) => {
	const [expanded, setExpanded] = useState(false);
	const created =
		row.created_time === undefined ? undefined : new Date(row.created_time);
	const createdLabel =
		created && !Number.isNaN(created.getTime())
			? `${created.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" })} ${created.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()}`
			: undefined;
	const values = [
		["name", formatMissing(row.name)],
		["created", formatMissing(createdLabel)],
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
			<button
				type="button"
				className={styles.toggle}
				aria-label="Mixcloud data details"
				aria-expanded={expanded}
				aria-controls={`mixcloud-details-${row.id}`}
				onClick={() => setExpanded(!expanded)}
			>
				<span className={styles.toggleLabel}>{expanded ? "Less" : "More"}</span>
				<img
					className={styles.chevron}
					src={triangleIcon}
					width="24"
					height="24"
					alt=""
					aria-hidden="true"
				/>
			</button>
			<dl id={`mixcloud-details-${row.id}`}>
				{values.map(([label, value], index) => (
					<div key={label} hidden={index > 1 && !expanded}>
						<dt>{label}</dt>
						<dd>{label === "name" ? <strong>{value}</strong> : value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
};
