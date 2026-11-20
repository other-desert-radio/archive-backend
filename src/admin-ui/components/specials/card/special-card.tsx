import type { SpecialsAdminRow } from "../../../loaders/specials.js";
import styles from "./special-card.module.css";

type Props = {
	special: SpecialsAdminRow;
	onEdit: (special: SpecialsAdminRow) => void;
	onDelete: (special: SpecialsAdminRow) => void;
};
export const SpecialCard = ({ special, onEdit, onDelete }: Props) => (
	<article className={styles.card} aria-label={`Special ${special.title}`}>
		<div className={styles.name}>
			<span>{special.title}</span>
			{special.description && (
				// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized by the authenticated API before rendering.
				<div dangerouslySetInnerHTML={{ __html: special.description }} />
			)}
		</div>
		<div className={styles.actions}>
			<button
				type="button"
				className={styles.edit}
				onClick={() => onEdit(special)}
				aria-label={`Edit ${special.title}`}
			>
				Edit
			</button>
			<button
				type="button"
				className={styles.delete}
				aria-label={`Delete ${special.title}`}
				onClick={() => onDelete(special)}
			>
				Delete
			</button>
		</div>
	</article>
);
