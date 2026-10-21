import { Fragment, type ReactElement } from "react";
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
	const {
		status,
		detail,
		previousAttempts,
		historyError,
		starting,
		error,
		connected,
		loading,
	} = publication;
	const job = detail?.job ?? status?.latestJob;
	const running = job?.outcome === "running";
	const failed = job?.outcome === "failed" || job?.outcome === "interrupted";
	const complete = job?.outcome === "succeeded" || job?.outcome === "no-change";
	const canStart =
		status !== undefined && (failed || (!running && status.pending));
	const local = status?.mode === "local";
	const clean = status !== undefined && !status.pending && !running && !failed;
	const title = running
		? "Publishing archive"
		: failed
			? "Publication needs attention"
			: complete && !status?.pending
				? "Archive published"
				: clean
					? local
						? "All changes saved locally"
						: "All changes pushed"
					: "Publish archive?";
	const publishedAt = complete ? new Date(job.completedAt) : undefined;
	const lastPublished = publishedAt
		? `Last published ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(publishedAt)} ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(publishedAt)}`
		: "There are no pending archive changes to publish.";
	const description = running
		? "Publication continues when you close this window."
		: failed
			? "Review the logs below, then retry when you are ready."
			: complete && !status?.pending
				? lastPublished
				: clean
					? "There are no pending archive changes to publish."
					: local
						? "Write latest changes to your local archive checkout."
						: "Publish latest changes to github.";
	return (
		<MessageModal
			panelClassName={styles.panel}
			actionLayout="stacked"
			showCloseButton
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
					: { label: "Close", onClick: onClose, appearance: "text" }
			}
			{...(canStart
				? {
						secondaryAction: {
							label: "Close",
							onClick: onClose,
							appearance: "text",
						},
					}
				: {})}
		>
			<div className={styles.body}>
				{status && (
					<div>
						<p>
							{local ? "Local checkout:" : "Remote repository:"}{" "}
							<strong className={styles.branch}>
								{local ? status.target.checkoutPath : status.target.repository}
							</strong>
						</p>
						<p>
							{local ? "Current branch:" : "Target branch:"}{" "}
							<strong className={styles.branch}>
								{status.target.branch ?? "No branch metadata"}
							</strong>
						</p>
						{local && status.target.repository && (
							<p>Origin: {status.target.repository}</p>
						)}
					</div>
				)}
				{loading && <p role="status">Loading publication status…</p>}
				{!connected && !loading && (
					<p className={styles.helper} role="status">
						Live progress is disconnected. Reconnecting automatically; use
						Reload status to check the latest saved progress.
					</p>
				)}
				{job && !(complete && status?.pending) && (
					<p role="status">
						{running ? `Current stage: ${job.stage}` : `Result: ${job.outcome}`}
					</p>
				)}
				{job && job.outcome !== "running" && job.error && (
					<p role="alert">{job.error}</p>
				)}
				{error && <p role="alert">{error}</p>}
				{historyError && <p role="alert">{historyError}</p>}
				{(error || historyError || (!connected && !loading)) && (
					<div>
						<button
							type="button"
							className={styles.reload}
							onClick={() => void publication.refresh()}
						>
							Reload status
						</button>
					</div>
				)}
				{detail && (
					<details className={styles.logDetails}>
						<summary className={styles.logTitle}>Publication log</summary>
						<div
							className={styles.logs}
							role="log"
							aria-label="Publication log"
							aria-live="polite"
							aria-relevant="additions text"
							// biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable logs must be keyboard accessible
							tabIndex={0}
						>
							{[...previousAttempts, detail].map((attempt, index) => (
								<Fragment key={attempt.job.id}>
									{index > 0 && <br />}
									{attempt.logs.length === 0 ? (
										<p>Waiting for log entries…</p>
									) : (
										attempt.logs.map((line) => (
											<p key={line.sequence}>
												<time dateTime={line.timestamp}>{line.timestamp}</time>{" "}
												{line.message}
											</p>
										))
									)}
									{attempt.logsTruncated && (
										<p className={styles.helper}>
											Earlier log entries were removed. The latest 2,000 lines
											are retained.
										</p>
									)}
								</Fragment>
							))}
						</div>
					</details>
				)}
			</div>
		</MessageModal>
	);
};
