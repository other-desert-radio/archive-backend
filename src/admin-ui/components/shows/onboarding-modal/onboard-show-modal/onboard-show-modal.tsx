import { useRef, useState } from "react";
import type { UploadedShowConfirmation } from "../../../../../admin/routes/mixcloud/index.js";
import type { ShowsAdminRow } from "../../../../loaders/shows.js";
import {
	ShowFormModal,
	type ShowFormOptions,
} from "../show-form-modal/index.js";
import {
	SavedShowModal,
	UploadedShowModal,
} from "../uploaded-show-modal/index.js";

type Props = ShowFormOptions & {
	isOpen: boolean;
	tags: { id: number; title: string }[];
	onSaved: (show: ShowsAdminRow) => void;
};
const OnboardShowForm = (props: Omit<Props, "isOpen">) => {
	const opener = useRef(
		typeof document !== "undefined" &&
			document.activeElement instanceof HTMLElement
			? document.activeElement
			: undefined,
	);
	const [upload, setUpload] = useState<UploadedShowConfirmation>();
	const [saved, setSaved] = useState<ShowsAdminRow>();
	const close = () => {
		props.onClose();
		window.setTimeout(() => {
			if (opener.current?.isConnected) opener.current.focus();
		});
	};
	if (saved)
		return (
			<SavedShowModal
				show={saved}
				djs={props.djs}
				tags={props.tags}
				onClose={close}
			/>
		);
	if (upload)
		return (
			<UploadedShowModal
				key={upload.uploadId}
				{...props}
				upload={upload}
				onClose={close}
				onSaved={(show) => {
					setSaved(show);
					props.onSaved(show);
				}}
			/>
		);

	return (
		<ShowFormModal
			{...props}
			onClose={close}
			onUploaded={setUpload}
			title="Upload Show"
			idPrefix="show"
			initialValues={{
				tracklist: [],
				title: "",
				date: "",
				duration: "",
				mixcloud_image_small: "",
				mixcloud_image_large: "",
				tags: [],
				tagDraft: "",
				url: "",
				selected: [],
			}}
		/>
	);
};
/** Uploads a new Show, then reviews and saves its archive metadata. */
export const OnboardShowModal = ({ isOpen, ...props }: Props) =>
	isOpen ? <OnboardShowForm {...props} /> : null;
