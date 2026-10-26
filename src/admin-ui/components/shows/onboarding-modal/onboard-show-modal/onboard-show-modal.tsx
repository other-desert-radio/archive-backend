import { useState } from "react";
import {
	ShowFormModal,
	type ShowFormOptions,
	type ShowOnboardingMode,
} from "../show-form-modal/index.js";
import type { CreateShowForm } from "./onboard-show-utils.js";

type Props = ShowFormOptions & {
	isOpen: boolean;
	onSubmit: (request: CreateShowForm) => Promise<void>;
};
const OnboardShowForm = (props: Omit<Props, "isOpen">) => {
	const [mode, setMode] = useState<ShowOnboardingMode>("new_show");
	return (
		<ShowFormModal
			{...props}
			onboardingMode={{ value: mode, onChange: setMode }}
			title={mode === "new_show" ? "New Show" : "Import Show"}
			idPrefix="show"
			initialValues={{
				title: "",
				date: "",
				duration: "",
				image_small: "",
				image_large: "",
				tags: [],
				tagDraft: "",
				url: "",
				selected: [],
			}}
		/>
	);
};
/** Creates a Show with the same fields and validation used for editing. */
export const OnboardShowModal = ({ isOpen, ...props }: Props) =>
	isOpen ? <OnboardShowForm {...props} /> : null;
