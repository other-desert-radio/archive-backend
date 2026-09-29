import type { ReactNode } from "react";
import styles from "./tag.module.css";

type TagProps = {
	children: ReactNode;
	color?: string;
	as?: "li" | "span";
};

/** Renders a colored tag chip for resource views. */
export const Tag = ({ children, color, as: Component = "li" }: TagProps) => (
	<Component
		className={styles.tag}
		{...(color === undefined ? {} : { style: { backgroundColor: color } })}
	>
		{children}
	</Component>
);
