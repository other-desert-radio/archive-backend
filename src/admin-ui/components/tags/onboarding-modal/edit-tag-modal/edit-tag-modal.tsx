import { useRef, useState } from "react";
import type { ModifyTagRequest } from "../../../../../admin/routes/tags/index.js";
import type { TagsAdminRow } from "../../../../loaders/tags.js";
import {
	hasFormChanges,
	OnboardingModal,
} from "../../../shared/modal/index.js";
import { TagMetadataFields } from "../tag-metadata-fields/index.js";
import { buildModifyTagRequest, type TagFormValues } from "./edit-tag-utils.js";

type Props = {
	tag: TagsAdminRow;
	onClose: () => void;
	onSubmit: (request: ModifyTagRequest) => Promise<void>;
};
export const EditTagModal = ({ tag, onClose, onSubmit }: Props) => {
	const baseline = useRef<TagFormValues>({
		title: tag.title,
		color: tag.color,
		mixcloud_key: tag.mixcloud_key ?? "",
		mixcloud_url: tag.mixcloud_url ?? "",
	});
	const [fields, setFields] = useState(baseline.current);
	return (
		<OnboardingModal
			isOpen
			title="Edit Tag"
			onClose={onClose}
			onSubmit={async () => onSubmit(buildModifyTagRequest(tag.id, fields))}
			hasUnsavedChanges={hasFormChanges(fields, baseline.current)}
			submitLabel="Save"
			submittingLabel="Saving…"
			cancelLabel="Cancel"
			actionHelper="Saving marks this tag reviewed"
		>
			<TagMetadataFields
				idPrefix="edit-tag"
				fields={fields}
				setFields={setFields}
			/>
		</OnboardingModal>
	);
};
