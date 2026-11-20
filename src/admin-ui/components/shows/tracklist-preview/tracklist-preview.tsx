import type { ShowTracklistEntry } from "../../../../db/types.js";
import { formatTracklistEntry } from "../tracklist-editor-modal/tracklist-utils.js";
import styles from "./tracklist-preview.module.css";

type Props = {
	entries: ShowTracklistEntry[];
	labelledBy: string;
};

export const TracklistPreview = ({ entries, labelledBy }: Props) => (
	<section
		className={styles.preview}
		aria-labelledby={labelledBy}
		// biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable preview must be reachable by keyboard.
		tabIndex={0}
	>
		<table aria-labelledby={labelledBy}>
			<tbody>
				{entries.map((entry, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: Preview rows are stateless and entries have no IDs.
					<tr key={index}>
						<td className={styles.number}>{index + 1}</td>
						<td>{formatTracklistEntry(entry)}</td>
					</tr>
				))}
			</tbody>
		</table>
	</section>
);
