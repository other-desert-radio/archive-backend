import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
	SearchableMultiSelect,
	TagsInput,
	type TagsInputOption,
} from "../../../shared/modal/index.js";
import type { ShowFormValues } from "../show-form-state/index.js";

type Props = {
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
	tagHelper?: ReactNode;
};
export const ShowRelationshipFields = ({
	fields,
	setFields,
	idPrefix,
	djs,
	isDJsLoading,
	djsError,
	onRetryDJs,
	tagOptions,
	isTagsLoading,
	tagError,
	loadTagOptions,
	djHelper,
	highlightEmptyDJs = false,
	tagHelper,
}: Props) => {
	const { tags, tagDraft, selected } = fields;
	const djOptions = djs.map((dj) => ({
		id: dj.id,
		label: dj.title,
		searchText: `${dj.title} ${dj.id}`,
	}));
	return (
		<>
			<SearchableMultiSelect
				id={`${idPrefix}-djs`}
				label="DJs"
				helper={djHelper}
				highlightEmptySelection={highlightEmptyDJs}
				options={djOptions}
				selectedIds={selected}
				onChange={(selected) => setFields({ ...fields, selected })}
				isLoading={isDJsLoading}
				{...(djsError === undefined ? {} : { error: djsError })}
				onRetry={onRetryDJs}
			/>
			<TagsInput
				id={`${idPrefix}-tags`}
				helper={tagHelper}
				value={{ tags, draft: tagDraft }}
				onChange={(value) =>
					setFields({ ...fields, tags: value.tags, tagDraft: value.draft })
				}
				options={tagOptions}
				isLoading={isTagsLoading}
				{...(tagError === undefined ? {} : { error: tagError })}
				onRetry={loadTagOptions}
			/>
		</>
	);
};
