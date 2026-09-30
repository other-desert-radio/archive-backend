import type { ReactNode } from "react";
import { LabeledFormControl } from "../../../shared/modal/index.js";

type TextField = { value: string; onChange: (value: string) => void };
type Props = {
	idPrefix: string;
	title: TextField;
	showTitle: TextField;
	showDescription: TextField;
	socials: TextField;
	bio: TextField;
	children: ReactNode;
};

/** Keeps the common DJ fields in the same order around resource-specific controls. */
export const DJMetadataFields = ({
	idPrefix,
	title,
	showTitle,
	showDescription,
	socials,
	bio,
	children,
}: Props) => (
	<>
		<LabeledFormControl
			id={`${idPrefix}-title-input`}
			name="title"
			label="title"
			{...title}
			required
		/>
		<LabeledFormControl
			id={`${idPrefix}-show-title-input`}
			name="showTitle"
			label="show title"
			{...showTitle}
		/>
		<LabeledFormControl
			id={`${idPrefix}-show-description-input`}
			name="showDescription"
			label="show description"
			{...showDescription}
			textarea
		/>
		{children}
		<LabeledFormControl
			id={`${idPrefix}-socials-input`}
			name="socials"
			label="socials"
			{...socials}
			textarea
		/>
		<LabeledFormControl
			id={`${idPrefix}-bio-input`}
			name="bio"
			label="bio"
			{...bio}
			textarea
			required
		/>
	</>
);
