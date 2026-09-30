import { useState } from "react";
import type { CreateTagRequest } from "../../../../../admin/routes/tags/index.js";
import {
	hasFormChanges,
	OnboardingModal,
} from "../../../shared/modal/index.js";
import { TagMetadataFields } from "../tag-metadata-fields/index.js";
import { buildCreateTagRequest } from "./onboard-tag-utils.js";

const initialValues = {
	title: "",
	color: "#cccccc",
	mixcloud_key: "",
	mixcloud_url: "",
};
type Props = {
	onClose: () => void;
	onSubmit: (request: CreateTagRequest) => Promise<void>;
};
export const OnboardTagModal = ({ onClose, onSubmit }: Props) => {
	const [fields, setFields] = useState(initialValues);
	return (
		<OnboardingModal
			isOpen
			title="Onboard Tag"
			onClose={onClose}
			onSubmit={async () => onSubmit(buildCreateTagRequest(fields))}
			hasUnsavedChanges={hasFormChanges(fields, initialValues)}
			cancelLabel="Cancel"
			actionHelper="New tags are marked reviewed; existing titles reuse their current tag"
		>
			<TagMetadataFields idPrefix="tag" fields={fields} setFields={setFields} />
		</OnboardingModal>
	);
};
