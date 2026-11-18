import type { SpecialsAdminRow } from "../../../loaders/specials.js";
import styles from "./special-card.module.css";

type Props = {
	special: SpecialsAdminRow;
	onDelete: (special: SpecialsAdminRow) => void;
};
export const SpecialCard = ({ special, onDelete }: Props) => (
	<article className={styles.card} aria-label={`Special ${special.title}`}>
		<span className={styles.name}>{special.title}</span>
		<div className={styles.actions}>
			<span title="Editing specials is not available yet">
				<button type="button" disabled aria-label={`Edit ${special.title}`}>
					Edit
				</button>
			</span>
			<button
				type="button"
				aria-label={`Delete ${special.title}`}
				onClick={() => onDelete(special)}
			>
				Delete
			</button>
		</div>
	</article>
);
