import { LabeledFormControl } from "../../../shared/modal/index.js";
import { Tag } from "../../../shared/resource-views/index.js";
import {
	isTagColor,
	type TagFormValues,
} from "../edit-tag-modal/edit-tag-utils.js";
import styles from "./tag-metadata-fields.module.css";

type Props = {
	idPrefix: string;
	fields: TagFormValues;
	setFields: (fields: TagFormValues) => void;
};
export const TagMetadataFields = ({ idPrefix, fields, setFields }: Props) => (
	<>
		<LabeledFormControl
			id={`${idPrefix}-title`}
			name="title"
			label="title"
			value={fields.title}
			onChange={(title) => setFields({ ...fields, title })}
			required
		/>
		<LabeledFormControl
			id={`${idPrefix}-color`}
			name="color"
			label="color"
			value={fields.color}
			onChange={(color) => setFields({ ...fields, color })}
			required
			helper="Six-digit hex color (#RRGGBB)"
			trailingContent={
				<div className={styles.colorTools}>
					<input
						type="color"
						aria-label="Choose tag color"
						className={styles.colorPicker}
						value={isTagColor(fields.color) ? fields.color.trim() : "#000000"}
						onChange={(event) =>
							setFields({ ...fields, color: event.target.value })
						}
					/>
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
				</div>
			}
		/>
		<LabeledFormControl
			id={`${idPrefix}-mixcloud-key`}
			name="mixcloud_key"
			label="Mixcloud key"
			value={fields.mixcloud_key}
			onChange={(mixcloud_key) => setFields({ ...fields, mixcloud_key })}
		/>
		<LabeledFormControl
			id={`${idPrefix}-mixcloud-url`}
			name="mixcloud_url"
			label="Mixcloud URL"
			value={fields.mixcloud_url}
			onChange={(mixcloud_url) => setFields({ ...fields, mixcloud_url })}
			helper="Optional absolute HTTP(S) URL"
		/>
	</>
);
