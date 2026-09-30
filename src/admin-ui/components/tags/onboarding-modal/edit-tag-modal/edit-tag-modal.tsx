import { useRef, useState } from "react";
import type { ModifyTagRequest } from "../../../../../admin/routes/tags/index.js";
import type { TagsAdminRow } from "../../../../loaders/tags.js";
import {
	hasFormChanges,
	LabeledFormControl,
	OnboardingModal,
} from "../../../shared/modal/index.js";
import { Tag } from "../../../shared/resource-views/index.js";
import styles from "./edit-tag-modal.module.css";
import {
	buildModifyTagRequest,
	isTagColor,
	type TagFormValues,
} from "./edit-tag-utils.js";

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
			<LabeledFormControl
				id="edit-tag-title"
				name="title"
				label="title"
				value={fields.title}
				onChange={(title) => setFields({ ...fields, title })}
				required
			/>
			<LabeledFormControl
				id="edit-tag-color"
				name="color"
				label="color"
				value={fields.color}
				onChange={(color) => setFields({ ...fields, color })}
				required
				helper="Six-digit hex color (#RRGGBB)"
				trailingContent={
					<div
						role="status"
						aria-label="Tag color preview"
						className={styles.chip}
					>
						{isTagColor(fields.color) ? (
							<Tag as="span" color={fields.color.trim()}>
								{fields.title.trim()}
							</Tag>
						) : (
							<span className={styles.hint}>
								Enter a valid hex color to preview
							</span>
						)}
					</div>
				}
			/>
			<LabeledFormControl
				id="edit-tag-mixcloud-key"
				name="mixcloud_key"
				label="Mixcloud key"
				value={fields.mixcloud_key}
				onChange={(mixcloud_key) => setFields({ ...fields, mixcloud_key })}
			/>
			<LabeledFormControl
				id="edit-tag-mixcloud-url"
				name="mixcloud_url"
				label="Mixcloud URL"
				value={fields.mixcloud_url}
				onChange={(mixcloud_url) => setFields({ ...fields, mixcloud_url })}
				helper="Optional absolute HTTP(S) URL"
			/>
		</OnboardingModal>
	);
};
