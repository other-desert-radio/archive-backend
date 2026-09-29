import type { DJsAdminRow } from "../../../loaders/djs.js";
import type { TagsAdminRow } from "../../../loaders/tags.js";
import { Tag, TagsContainer } from "../../shared/resource-views/index.js";
import styles from "./dj-card.module.css";

type DJCardTag = Pick<TagsAdminRow, "color" | "title">;

const editDJ = () => undefined;

const djImage = (
	dj: Pick<DJsAdminRow, "image_small" | "image_large" | "title">,
) => {
	const image = dj.image_large ?? dj.image_small;

	return image === undefined ? (
		<div className={styles.imagePlaceholder}>No image</div>
	) : (
		<img className={styles.image} src={image} alt={dj.title} loading="lazy" />
	);
};

const djTags = (
	dj: Pick<DJsAdminRow, "tags" | "title">,
	tagsById: ReadonlyMap<number, DJCardTag>,
) =>
	dj.tags.length === 0 ? (
		<p className={styles.noTags}>No tags</p>
	) : (
		<TagsContainer label={`${dj.title} tags`}>
			{dj.tags.map((tagId) => {
				const tag = tagsById.get(tagId);
				return (
					<Tag key={tagId} {...(tag === undefined ? {} : { color: tag.color })}>
						{tag?.title ?? `Tag #${tagId}`}
					</Tag>
				);
			})}
		</TagsContainer>
	);

/** Renders a DJ-specific grid card with its portrait, title, and tags. */
export const renderDJCard = (
	dj: DJsAdminRow,
	tagsById: ReadonlyMap<number, DJCardTag> = new Map(),
	key: string | number = dj.id,
) => {
	return (
		<article className={styles.card} key={key}>
			{djImage(dj)}
			<h2 className={styles.title}>{dj.title}</h2>
			{djTags(dj, tagsById)}
			<button
				type="button"
				className={styles.edit}
				onClick={editDJ}
				aria-label={`Edit ${dj.title}`}
			>
				Edit
			</button>
		</article>
	);
};
