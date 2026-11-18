import { useState } from "react";
import type { CreateSpecialRequest } from "../../../../../admin/routes/specials/index.js";
import { FormModal, LabeledFormControl } from "../../../shared/modal/index.js";

type Props = {
	onClose: () => void;
	onSubmit: (request: CreateSpecialRequest) => Promise<void>;
};
export const OnboardSpecialModal = ({ onClose, onSubmit }: Props) => {
	const [title, setTitle] = useState("");
	return (
		<FormModal
			isOpen
			title="Create special"
			onClose={onClose}
			onSubmit={async () => {
				if (!title.trim()) throw new Error("Name is required");
				await onSubmit({ title: title.trim() });
			}}
			hasUnsavedChanges={title !== ""}
			isSubmitDisabled={!title.trim()}
			submitLabel="Create"
			submittingLabel="Creating…"
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
		</FormModal>
	);
};
