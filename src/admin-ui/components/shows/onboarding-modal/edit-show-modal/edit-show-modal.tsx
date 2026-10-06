import type { ModifyShowRequest } from "../../../../../admin/routes/shows/index.js";
import type { ShowsAdminRow } from "../../../../loaders/shows.js";
import type { TagsAdminRow } from "../../../../loaders/tags.js";
import {
	ShowFormModal,
	type ShowFormOptions,
} from "../show-form-modal/index.js";

type Props = ShowFormOptions & {
	show: ShowsAdminRow;
	tags: TagsAdminRow[];
	onSubmit: (request: ModifyShowRequest) => Promise<void>;
};
/** Prefills existing Show metadata and relationships for replacement editing. */
export const EditShowModal = ({ show, tags, onSubmit, ...props }: Props) => {
	const tagsById = new Map(tags.map((tag) => [tag.id, tag.title]));
	return (
		<ShowFormModal
			{...props}
			title="Edit Show"
			idPrefix="edit-show"
			submitLabel="Save"
			submittingLabel="Saving…"
			initialValues={{
				title: show.title,
				date: show.date.slice(0, 10),
				duration: String(show.duration),
				image_small: show.image_small,
				image_large: show.image_large,
				url: show.url,
				selected: show.djs,
				tagDraft: "",
				tags: show.tags.flatMap((id) => {
					const title = tagsById.get(id);
					return title === undefined ? [] : [{ title }];
				}),
			}}
			unresolvedTagIds={show.tags.filter((id) => !tagsById.has(id))}
			onSubmit={(request) => onSubmit({ ...request, id: show.id })}
		/>
	);
};
