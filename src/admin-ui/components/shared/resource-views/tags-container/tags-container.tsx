import type { ReactNode } from "react";
import styles from "./tags-container.module.css";

type TagsContainerProps = {
	children: ReactNode;
	label: string;
};

/** Groups resource-view tag chips in an accessible wrapping list. */
export const TagsContainer = ({ children, label }: TagsContainerProps) => (
	<ul className={styles.tags} aria-label={label}>
		{children}
	</ul>
);
