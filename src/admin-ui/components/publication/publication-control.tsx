import type { ReactElement } from "react";
import styles from "./publication.module.css";
import type { PublicationView } from "./use-publication.js";
export type PublicationControlProps = {
	publication: PublicationView;
	onOpen: () => void;
};
export const PublicationControl = ({
	publication,
	onOpen,
}: PublicationControlProps): ReactElement | null => {
	const { status, detail, error } = publication;
	const job = status?.latestJob ?? detail?.job;
	const running = job?.outcome === "running";
	const failed = job?.outcome === "failed" || job?.outcome === "interrupted";
	const clean =
		status !== undefined && !status.pending && !running && !failed && !error;
	if (!status && !error && !running && !failed) return null;
	return (
		<button
			type="button"
			className={[styles.control, clean ? styles.clean : undefined]
				.filter(Boolean)
				.join(" ")}
			onClick={onOpen}
			aria-haspopup="dialog"
		>
			{running
				? "Publishing…"
				: clean
					? status?.mode === "local"
						? "all changes saved"
						: "all changes pushed"
					: "publish changes"}
		</button>
	);
};
