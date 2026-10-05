import { useState } from "react";
import type { MixcloudImportAdminRow } from "../../../../loaders/mixcloud-imports.js";
import type { ShowsAdminRow } from "../../../../loaders/shows.js";
import { ImportShowModal } from "../import-show-modal/index.js";

type Props = {
	/** Ordered pending rows captured when the parent opens this import session. */
	items: MixcloudImportAdminRow[];
	/** Live category count, including the current row and skipped pending rows. */
	remainingCount: number;
	/** Ends the session; the parent owns dismissal and launcher focus restoration. */
	onClose: () => void;
	/** Reports a committed import so the parent can update rows/counts and reload. */
	onImported: (rowId: number, show: ShowsAdminRow) => void;
};

/**
 * Navigates a session snapshot without changing its order as parent data reloads.
 * Skip only moves the cursor: skipped rows remain pending and can be revisited
 * with Previous or in a new session. Successful imports are excluded from both
 * navigation directions for the rest of this mounted session.
 *
 * ImportShowModal owns saving and dirty-edit confirmation. Changing its source
 * row remounts the keyed form, so each visit starts from that row's source data.
 */
export const MixcloudImportQueue = ({
	items,
	remainingCount,
	onClose,
	onImported,
}: Props) => {
	const [index, setIndex] = useState(0);
	// Track committed rows locally because the session snapshot retains them.
	const [importedIds, setImportedIds] = useState<number[]>([]);
	// Retain the last eligible index before the cursor, including skipped rows.
	const previousIndex = items.reduce(
		(previous, item, itemIndex) =>
			itemIndex < index && !importedIds.includes(item.id)
				? itemIndex
				: previous,
		-1,
	);
	const row = items[index];
	if (row === undefined) return null;
	// Only scan forward; reaching the end closes even if skipped rows remain.
	const advance = () => {
		const nextIndex = items.findIndex(
			(item, itemIndex) => itemIndex > index && !importedIds.includes(item.id),
		);
		if (nextIndex === -1) onClose();
		else setIndex(nextIndex);
	};
	return (
		<ImportShowModal
			row={row}
			remainingCount={remainingCount}
			onClose={onClose}
			onSkip={advance}
			onPrevious={
				previousIndex === -1 ? undefined : () => setIndex(previousIndex)
			}
			onImported={(show) => {
				// The modal calls this after success, including an already-imported
				// response. Mark it complete before notifying the parent and moving on.
				setImportedIds((ids) => [...ids, row.id]);
				onImported(row.id, show);
				// advance uses this render's importedIds, which is safe because it
				// searches strictly after the current row, never the newly imported one.
				advance();
			}}
		/>
	);
};
