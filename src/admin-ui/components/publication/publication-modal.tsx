import type { ReactElement } from "react";
import { MessageModal } from "../shared/modal/index.js";
import styles from "./publication.module.css";
import type { PublicationView } from "./use-publication.js";
export type PublicationModalProps = {
	publication: PublicationView;
	onClose: () => void;
};
export const PublicationModal = ({
	publication,
	onClose,
}: PublicationModalProps): ReactElement => {
	const { status, detail, starting, error, connected, loading } = publication;
	const job = detail?.job ?? status?.latestJob;
	const running = job?.outcome === "running";
	const failed = job?.outcome === "failed" || job?.outcome === "interrupted";
	const complete = job?.outcome === "succeeded" || job?.outcome === "no-change";
	const canStart = status?.enabled && (failed || (!running && status.pending));
	const title = running
		? "Publishing archive"
		: failed
			? "Publication needs attention"
			: complete && !status?.pending
				? "Archive published"
				: "Publish archive?";
	const description = running
		? "Publication continues when you close this window."
		: failed
			? "Review the logs below, then retry when you are ready."
			: complete && !status?.pending
				? "The archive was pushed to GitHub. Site deployment may still be running."
				: "Archive changes are pending. Publish the latest archive data and images to GitHub.";
	return (
		<MessageModal
			title={title}
			message={description}
			onDismiss={onClose}
			restoreFocus
			initialFocus="secondary"
			primaryAction={
				canStart
					? {
							label: starting
								? "Starting…"
								: failed
									? "Retry publication"
									: "Publish",
							disabled: starting || loading,
							onClick: () =>
								void publication.start(failed ? job?.id : undefined),
						}
					: { label: "Close", onClick: onClose }
			}
			{...(canStart
				? { secondaryAction: { label: "Close", onClick: onClose } }
				: {})}
		>
			<div className={styles.body}>
				{status && (
					<p>
						Target branch:{" "}
						<strong className={styles.branch}>{status.branch}</strong>
					</p>
				)}
				{loading && <p role="status">Loading publication status…</p>}
				{!connected && !loading && (
					<p className={styles.helper} role="status">
						Reconnecting to live progress…
					</p>
				)}
				{job && (
					<p role="status">
						{running ? `Current stage: ${job.stage}` : `Result: ${job.outcome}`}
					</p>
				)}
				{job && job.outcome !== "running" && job.error && (
					<p role="alert">{job.error}</p>
				)}
				{error && (
					<div role="alert">
						<p>{error}</p>
						<button type="button" onClick={() => void publication.refresh()}>
							Reload status
						</button>
					</div>
				)}
				{detail && (
					<>
						<h3 className={styles.logTitle}>Publication log</h3>
						<div
							className={styles.logs}
							role="log"
							aria-label="Publication log"
							aria-live="polite"
							aria-relevant="additions text"
							// biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable logs must be keyboard accessible
							tabIndex={0}
						>
							{detail.logs.length === 0 ? (
								<p>Waiting for log entries…</p>
							) : (
								detail.logs.map((line) => (
									<p key={line.sequence}>
										<time dateTime={line.timestamp}>{line.timestamp}</time>{" "}
										{line.message}
									</p>
								))
							)}
						</div>
						{detail.logsTruncated && (
							<p className={styles.helper}>
								Earlier log entries were removed. The latest 2,000 lines are
								retained.
							</p>
						)}
					</>
				)}
			</div>
		</MessageModal>
	);
};
