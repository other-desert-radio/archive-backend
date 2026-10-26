import type { ComponentProps } from "react";
import { FileDropzone } from "../../../shared/modal/file-dropzone/index.js";
import { validateDJImageFile } from "../utils/index.js";

type Props = Omit<
	ComponentProps<typeof FileDropzone>,
	"accept" | "name" | "preview" | "validateFile" | "style"
>;

/** Keeps image validation and preview specific to DJs. */
export const DJImageDropzone = (props: Props) => (
	<FileDropzone
		id="onboard-dj-image-input"
		label="image"
		{...props}
		accept="image/jpeg,image/png,image/webp"
		name="image"
		preview
		validateFile={validateDJImageFile}
	/>
);
