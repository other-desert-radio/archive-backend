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

/** Visits each session item once; Skip leaves the underlying tracking row pending. */
export const MixcloudImportQueue = ({
	items,
	remainingCount,
	onClose,
	onImported,
}: Props) => {
	const [index, setIndex] = useState(0);
	const row = items[index];
	if (row === undefined) return null;
	const advance = () => {
		if (index + 1 >= items.length) onClose();
		else setIndex(index + 1);
	};
	return (
		<ImportShowModal
			row={row}
			remainingCount={remainingCount}
			onClose={onClose}
			onSkip={advance}
			onImported={(show) => {
				onImported(row.id, show);
				advance();
			}}
		/>
	);
};
