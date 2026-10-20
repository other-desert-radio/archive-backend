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
	if (status && !status.enabled) return null;
	const running = job?.outcome === "running";
	const failed = job?.outcome === "failed" || job?.outcome === "interrupted";
	if (!running && !failed && !status?.pending && !error) return null;
	return (
		<button
			type="button"
			className={styles.control}
			onClick={onOpen}
			aria-haspopup="dialog"
		>
			{running
				? "Publishing…"
				: failed
					? "Retry"
					: error
						? "Publication status"
						: "Publish"}
		</button>
	);
};
