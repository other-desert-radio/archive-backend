import {
	ImportShowForm,
	type ImportShowFormProps,
} from "../import-show-form/index.js";

/** Resets values, baselines, requests, and selector searches when the source changes. */
export const ImportShowModal = (props: ImportShowFormProps) => (
	<ImportShowForm key={props.row.id} {...props} />
);
