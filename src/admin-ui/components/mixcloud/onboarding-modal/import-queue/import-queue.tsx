import { useState } from "react";
import type { MixcloudImportAdminRow } from "../../../../loaders/mixcloud-imports.js";
import type { ShowsAdminRow } from "../../../../loaders/shows.js";
import { ImportShowModal } from "../import-show-modal/index.js";

type Props = {
	items: MixcloudImportAdminRow[];
	remainingCount: number;
	onClose: () => void;
	onImported: (rowId: number, show: ShowsAdminRow) => void;
};

/** Navigates pending session items; Skip leaves the tracking row pending. */
export const MixcloudImportQueue = ({
	items,
	remainingCount,
	onClose,
	onImported,
}: Props) => {
	const [index, setIndex] = useState(0);
	const [importedIds, setImportedIds] = useState<number[]>([]);
	const previousIndex = items.reduce(
		(previous, item, itemIndex) =>
			itemIndex < index && !importedIds.includes(item.id)
				? itemIndex
				: previous,
		-1,
	);
	const row = items[index];
	if (row === undefined) return null;
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
				setImportedIds((ids) => [...ids, row.id]);
				onImported(row.id, show);
				advance();
			}}
		/>
	);
};
