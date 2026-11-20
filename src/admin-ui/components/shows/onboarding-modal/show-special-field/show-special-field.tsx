import type { Dispatch, SetStateAction } from "react";
import { SearchableMultiSelect } from "../../../shared/modal/index.js";
import type { ShowFormValues } from "../show-form-state/index.js";
import type { useSpecialOptions } from "./use-special-options.js";

export const ShowSpecialField = ({
	fields,
	setFields,
	idPrefix,
	options,
	hideSearchHelp = false,
}: {
	fields: ShowFormValues;
	setFields: Dispatch<SetStateAction<ShowFormValues>>;
	idPrefix: string;
	options: ReturnType<typeof useSpecialOptions>;
	hideSearchHelp?: boolean | undefined;
}) => {
	const missing =
		fields.special_id != null &&
		!options.isLoading &&
		!options.error &&
		!options.specials.some((special) => special.id === fields.special_id);
	return (
		<SearchableMultiSelect
			singleSelection
			muted={fields.selected.length > 0 && fields.special_id == null}
			hideSearchHelp={hideSearchHelp}
			id={`${idPrefix}-special`}
			label="Special"
			emptyMessage="No specials available."
			options={[
				...options.specials.map((special) => ({
					id: special.id,
					label: special.title,
					searchText: `${special.title} ${special.id}`,
				})),
				...(missing && fields.special_id != null
					? [
							{
								id: fields.special_id,
								label: `Missing special #${fields.special_id}`,
								searchText: "",
							},
						]
					: []),
			]}
			selectedIds={fields.special_id == null ? [] : [fields.special_id]}
			onChange={(ids) =>
				setFields((current) => ({ ...current, special_id: ids[0] ?? null }))
			}
			isLoading={options.isLoading}
			{...(options.error === undefined ? {} : { error: options.error })}
			onRetry={options.reload}
			{...(missing
				? {
						helper:
							"Selected special no longer exists. Remove it or choose another.",
					}
				: {})}
		/>
	);
};
