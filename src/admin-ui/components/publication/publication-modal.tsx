import type { ReactElement } from "react";
import type { PublicationView } from "./use-publication.js";
/** Reuse shared modal/focus primitives for confirmation, progress, and retry. */
export type PublicationModalProps = {
	publication: PublicationView;
	onClose: () => void;
};

export const PublicationModal = (
	_props: PublicationModalProps,
): ReactElement => {
	throw new Error("Not implemented: PublicationModal");
};
