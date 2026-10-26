import type { ComponentProps } from "react";
import { FileDropzone } from "../../file-dropzone/index.js";
import { validateImageFile } from "../utils/index.js";

type Props = Omit<
	ComponentProps<typeof FileDropzone>,
	"accept" | "preview" | "validateFile" | "style"
>;

/** Keeps image validation and preview shared across resources. */
export const ImageDropzone = (props: Props) => (
	<FileDropzone
		label="image"
		{...props}
		accept="image/jpeg,image/png,image/webp"
		preview
		validateFile={validateImageFile}
	/>
);
