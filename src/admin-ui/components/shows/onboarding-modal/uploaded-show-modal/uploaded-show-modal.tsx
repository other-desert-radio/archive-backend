import type { ReactElement } from "react";
import type { UploadedShowConfirmation } from "../../../../../admin/routes/mixcloud/index.js";
import type { ShowsAdminRow } from "../../../../loaders/shows.js";
import type { ShowFormOptions } from "../show-form-modal/index.js";

export type UploadedShowModalProps = ShowFormOptions & {
	upload: UploadedShowConfirmation;
	/** Committed success only; resource reload errors must not reject this save. */
	onSaved: (show: ShowsAdminRow) => void;
};

/** Announce upload → prepare/retry → edit editorial fields → save/retry.
 * Reuse OnboardingModal and existing controls; provider fields are read-only.
 * Retain edits on save failure and ignore prepare results after dismissal.
 * Scaffold is not mounted by the live onboarding flow.
 */
export const UploadedShowModal = (
	_props: UploadedShowModalProps,
): ReactElement => {
	throw new Error("Not implemented: UploadedShowModal");
};
