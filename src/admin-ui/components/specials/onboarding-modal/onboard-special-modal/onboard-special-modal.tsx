import { useState } from "react";
import type { CreateSpecialRequest } from "../../../../../admin/routes/specials/index.js";
import { safeHtmlToPlainText } from "../../../../../utils/index.js";
import { FormModal, LabeledFormControl } from "../../../shared/modal/index.js";

type Props = {
	special?: { id: number; title: string; description?: string | undefined };
	onClose: () => void;
	onSubmit: (request: CreateSpecialRequest) => Promise<void>;
};
export const OnboardSpecialModal = ({ special, onClose, onSubmit }: Props) => {
	const initialDescription = safeHtmlToPlainText(special?.description ?? "");
	const [description, setDescription] = useState(initialDescription);
	const [title, setTitle] = useState(special?.title ?? "");
	return (
		<FormModal
			isOpen
			title={special ? "Edit special" : "Create special"}
			onClose={onClose}
			onSubmit={async () => {
				if (!title.trim()) throw new Error("Name is required");
				await onSubmit({
					title: title.trim(),
					description: description.trim(),
				});
			}}
			hasUnsavedChanges={
				title !== (special?.title ?? "") || description !== initialDescription
			}
			isSubmitDisabled={!title.trim()}
			submitLabel={special ? "Save" : "Create"}
			submittingLabel={special ? "Saving…" : "Creating…"}
			cancelLabel="Cancel"
		>
			<LabeledFormControl
				id="special-title"
				name="title"
				label="name"
				value={title}
				onChange={setTitle}
				required
			/>
			<LabeledFormControl
				id="special-description"
				name="description"
				label="description"
				value={description}
				onChange={setDescription}
				textarea
			/>
		</FormModal>
	);
};
