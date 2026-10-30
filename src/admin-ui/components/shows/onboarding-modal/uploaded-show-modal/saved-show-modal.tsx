import type { ShowsAdminRow } from "../../../../loaders/shows.js";
import { MessageModal } from "../../../shared/modal/index.js";
import {
	formatDuration,
	formatUTCDateTime,
	SanitizedHTML,
} from "../../../shared/resource-views/index.js";
import styles from "./uploaded-show-modal.module.css";

export type SavedShowModalProps = {
	show: ShowsAdminRow;
	djs: { id: number; title: string }[];
	tags: { id: number; title: string }[];
	onClose: () => void;
};

/** Persistent confirmation uses the saved response, with IDs when labels cannot load. */
export const SavedShowModal = ({
	show,
	djs,
	tags,
	onClose,
}: SavedShowModalProps) => {
	const labels = (ids: number[], options: { id: number; title: string }[]) =>
		ids
			.map((id) => {
				const title = options.find((option) => option.id === id)?.title;
				return title === undefined ? `ID ${id}` : `${title} (ID ${id})`;
			})
			.join(", ") || "None";
	return (
		<MessageModal
			title="Show saved"
			message="Your show was successfully added to the archive."
			primaryAction={{ label: "Close", onClick: onClose }}
			onDismiss={onClose}
			panelClassName={styles.successPanel}
			initialFocus="close"
			showCloseButton
		>
			<dl className={styles.details}>
				<div>
					<dt>ID</dt>
					<dd>{show.id}</dd>
				</div>
				<div>
					<dt>created</dt>
					<dd>{formatUTCDateTime(show.createdAt)}</dd>
				</div>
				<div>
					<dt>title</dt>
					<dd>{show.title}</dd>
				</div>
				<div>
					<dt>description</dt>
					<dd className={styles.description}>
						{show.description ? (
							<SanitizedHTML html={show.description} />
						) : (
							"None"
						)}
					</dd>
				</div>
				<div>
					<dt>date</dt>
					<dd>{show.date.slice(0, 10)}</dd>
				</div>
				<div>
					<dt>duration</dt>
					<dd>{formatDuration(show.duration)}</dd>
				</div>
				<div>
					<dt>DJs</dt>
					<dd>{labels(show.djs, djs)}</dd>
				</div>
				<div>
					<dt>tags</dt>
					<dd>{labels(show.tags, tags)}</dd>
				</div>
				<div>
					<dt>show URL</dt>
					<dd>
						<a href={show.url} target="_blank" rel="noreferrer">
							{show.url}
						</a>
					</dd>
				</div>
				<div>
					<dt>small image URL</dt>
					<dd>
						<a
							href={show.mixcloud_image_small}
							target="_blank"
							rel="noreferrer"
						>
							{show.mixcloud_image_small}
						</a>
					</dd>
				</div>
				<div>
					<dt>large image URL</dt>
					<dd>
						<a
							href={show.mixcloud_image_large}
							target="_blank"
							rel="noreferrer"
						>
							{show.mixcloud_image_large}
						</a>
					</dd>
				</div>
				<div>
					<dt>cover</dt>
					<dd>
						<img
							className={styles.preview}
							src={show.image}
							alt={`Cover for ${show.title}`}
						/>
					</dd>
				</div>
			</dl>
		</MessageModal>
	);
};
