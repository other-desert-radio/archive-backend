import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
	SearchableMultiSelect,
	TagsInput,
	type TagsInputOption,
} from "../../../shared/modal/index.js";
import type { ShowFormValues } from "../show-form-state/index.js";
import {
	ShowSpecialField,
	type useSpecialOptions,
} from "../show-special-field/index.js";
import styles from "./show-relationship-fields.module.css";

type Props = {
	specialOptions: ReturnType<typeof useSpecialOptions>;
	groupRelationships?: boolean;
	fields: ShowFormValues;
	setFields: Dispatch<SetStateAction<ShowFormValues>>;
	idPrefix: string;
	djs: { id: number; title: string }[];
	isDJsLoading: boolean;
	djsError?: string | undefined;
	onRetryDJs: () => void;
	tagOptions: TagsInputOption[];
	isTagsLoading: boolean;
	tagError?: string | undefined;
	loadTagOptions: () => void;
	djHelper?: ReactNode;
	highlightEmptyDJs?: boolean;
	hideInstructions?: boolean;
	tagHelper?: ReactNode;
};
type AssignmentProps = Omit<
	Props,
	"tagOptions" | "isTagsLoading" | "tagError" | "loadTagOptions" | "tagHelper"
>;

export const ShowAssignmentFields = ({
	specialOptions,
	groupRelationships = false,
	fields,
	setFields,
	idPrefix,
	djs,
	isDJsLoading,
	djsError,
	onRetryDJs,
	djHelper,
	highlightEmptyDJs = false,
	hideInstructions = false,
}: AssignmentProps) => {
	const djOptions = djs.map((dj) => ({
		id: dj.id,
		label: dj.title,
		searchText: `${dj.title} ${dj.id}`,
	}));
	return (
		<div className={groupRelationships ? styles.group : styles.relationships}>
			{groupRelationships && !hideInstructions && (
				<p className={styles.guidance}>
					Choose archive DJs or a special to save this show.
				</p>
			)}
			<SearchableMultiSelect
				id={`${idPrefix}-djs`}
				label="DJs"
				muted={fields.special_id != null && fields.selected.length === 0}
				helper={djHelper}
				highlightEmptySelection={highlightEmptyDJs && fields.special_id == null}
				options={djOptions}
				selectedIds={fields.selected}
				onChange={(selected) => setFields({ ...fields, selected })}
				isLoading={isDJsLoading}
				{...(djsError === undefined ? {} : { error: djsError })}
				onRetry={onRetryDJs}
			/>
			<ShowSpecialField
				fields={fields}
				setFields={setFields}
				idPrefix={idPrefix}
				options={specialOptions}
			/>
		</div>
	);
};

export const ShowRelationshipFields = ({
	tagOptions,
	isTagsLoading,
	tagError,
	loadTagOptions,
	tagHelper,
	...props
}: Props) => (
	<>
		<ShowAssignmentFields {...props} />
		<TagsInput
			id={`${props.idPrefix}-tags`}
			helper={tagHelper}
			value={{ tags: props.fields.tags, draft: props.fields.tagDraft }}
			onChange={({ tags, draft }) =>
				props.setFields((current) => ({ ...current, tags, tagDraft: draft }))
			}
			options={tagOptions}
			isLoading={isTagsLoading}
			{...(tagError === undefined ? {} : { error: tagError })}
			onRetry={loadTagOptions}
		/>
	</>
);
