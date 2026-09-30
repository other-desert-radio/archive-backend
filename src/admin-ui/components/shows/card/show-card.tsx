import type { ShowsAdminRow } from "../../../loaders/shows.js";
import type { TagsAdminRow } from "../../../loaders/tags.js";
import { Tag, TagsContainer } from "../../shared/resource-views/index.js";
import styles from "./show-card.module.css";

type ShowCardTag = Pick<TagsAdminRow, "color" | "title">;
type ShowCardDJ = { title: string };

const showImage = (show: Pick<ShowsAdminRow, "image" | "title">) =>
	show.image === undefined ? (
		<div className={styles.imagePlaceholder}>No image</div>
	) : (
		<img
			className={styles.image}
			src={show.image}
			alt={show.title}
			loading="lazy"
		/>
	);

const showTags = (
	show: Pick<ShowsAdminRow, "tags" | "title">,
	tagsById: ReadonlyMap<number, ShowCardTag>,
) =>
	show.tags.length === 0 ? (
		<p className={styles.noTags}>No tags</p>
	) : (
		<TagsContainer label={`${show.title} tags`}>
			{show.tags.map((tagId) => {
				const tag = tagsById.get(tagId);
				return (
					<Tag key={tagId} {...(tag === undefined ? {} : { color: tag.color })}>
						{tag?.title ?? `Tag #${tagId}`}
					</Tag>
				);
			})}
		</TagsContainer>
	);

const showDJs = (
	show: Pick<ShowsAdminRow, "djs" | "title">,
	djsById: ReadonlyMap<number, ShowCardDJ>,
) =>
	show.djs.length === 0 ? (
		<p className={styles.noDJs}>No DJs</p>
	) : (
		<p className={styles.djs}>
			{show.djs
				.map((djId) => djsById.get(djId)?.title ?? `DJ #${djId}`)
				.join(", ")}
		</p>
	);

/** Renders a Show-specific grid card with its image, title, DJs, and tags. */
export const renderShowCard = (
	show: ShowsAdminRow,
	tagsById: ReadonlyMap<number, ShowCardTag> = new Map(),
	djsById: ReadonlyMap<number, ShowCardDJ> = new Map(),
	key: string | number = show.id,
	onEdit?: (show: ShowsAdminRow) => void,
) => {
	return (
		<article className={styles.card} key={key}>
			{showImage(show)}
			<h2 className={styles.title}>{show.title}</h2>
			{showDJs(show, djsById)}
			{showTags(show, tagsById)}
			<button
				type="button"
				className={styles.edit}
				onClick={() => onEdit?.(show)}
				aria-label={`Edit ${show.title}`}
			>
				Edit
			</button>
		</article>
	);
};
