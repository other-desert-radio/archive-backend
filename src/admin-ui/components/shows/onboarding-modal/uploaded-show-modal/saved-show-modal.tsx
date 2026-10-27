import type { ReactElement } from "react";
import type { ShowsAdminRow } from "../../../../loaders/shows.js";

export type SavedShowModalProps = {
	show: ShowsAdminRow;
	djs: { id: number; title: string }[];
	tags: { id: number; title: string }[];
	onClose: () => void;
};

/** Persistent MessageModal showing the returned Show, with ID fallbacks for labels.
 * Own no mutations or timers; Close restores focus to the original opener.
 * Scaffold is not mounted by the live onboarding flow.
 */
export const SavedShowModal = (_props: SavedShowModalProps): ReactElement => {
	throw new Error("Not implemented: SavedShowModal");
};
