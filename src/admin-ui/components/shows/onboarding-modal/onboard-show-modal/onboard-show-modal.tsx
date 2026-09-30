import {
	ShowFormModal,
	type ShowFormOptions,
} from "../show-form-modal/index.js";
import type { CreateShowForm } from "./onboard-show-utils.js";

type Props = ShowFormOptions & {
	isOpen: boolean;
	onSubmit: (request: CreateShowForm) => Promise<void>;
};
/** Creates a Show with the same fields and validation used for editing. */
export const OnboardShowModal = ({ isOpen, ...props }: Props) =>
	isOpen ? (
		<ShowFormModal
			{...props}
			title="Onboard Show"
			idPrefix="show"
			initialValues={{
				title: "",
				date: "",
				duration: "",
				image: "",
				tags: [],
				tagDraft: "",
				url: "",
				selected: [],
			}}
		/>
	) : null;
