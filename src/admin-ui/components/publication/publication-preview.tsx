import { Fragment, type ReactElement } from "react";
import type { PublicationPreview } from "../../../publication/index.js";
import styles from "./publication.module.css";

const resources = [
	{ key: "tags", label: "Tags" },
	{ key: "shows", label: "Shows" },
	{ key: "djs", label: "DJs" },
] as const;

type PreviewProps = {
	preview?: PublicationPreview | undefined;
	error?: string | undefined;
	onRefresh: () => void;
};
export const PublicationPreviewContent = ({
	preview,
	error,
	onRefresh,
}: PreviewProps): ReactElement => (
	<section className={styles.preview} aria-label="Pending changes">
		<h3>Pending changes</h3>
		{error ? (
			<>
				<p role="alert">{error}</p>
				<button type="button" className={styles.reload} onClick={onRefresh}>
					Refresh preview
				</button>
			</>
		) : !preview ? (
			<p role="status">Preparing changes…</p>
		) : (
			<>
				<dl className={styles.changeGrid}>
					{resources.map(({ key, label }) => {
						const changes = preview.changes[key];
						if (!Object.values(changes).some((names) => names.length))
							return null;
						return (
							<Fragment key={key}>
								<dt>{label}</dt>
								<dd>
									<ul className={styles.changeSummary}>
										{(["added", "changed", "removed"] as const).map((kind) => {
											const names = changes[kind];
											return names.length ? (
												<li key={kind}>
													<strong>{kind}</strong> {names.join(", ")}
												</li>
											) : null;
										})}
									</ul>
								</dd>
							</Fragment>
						);
					})}
				</dl>
				{!Object.values(preview.changes).some((changes) =>
					Object.values(changes).some((names) => names.length),
				) && <p>No changes to publish.</p>}
			</>
		)}
	</section>
);
