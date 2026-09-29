import type { ReactNode } from "react";
import styles from "./tag.module.css";

type TagProps = {
	children: ReactNode;
	color?: string;
};

/** Renders a colored tag chip for resource views. */
export const Tag = ({ children, color }: TagProps) => (
	<li
		className={styles.tag}
		{...(color === undefined ? {} : { style: { backgroundColor: color } })}
	>
		{children}
	</li>
);
