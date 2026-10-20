import type { ReactElement } from "react";
import type { PublicationView } from "./use-publication.js";
export type PublicationControlProps = {
	publication: PublicationView;
	onOpen: () => void;
};

export const PublicationControl = (
	_props: PublicationControlProps,
): ReactElement | null => {
	throw new Error("Not implemented: PublicationControl");
};
