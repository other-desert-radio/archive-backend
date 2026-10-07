import type { ReactNode } from "react";
import styles from "./tag.module.css";

type TagProps = {
	children: ReactNode;
	color?: string;
	as?: "li" | "span";
	size?: "default" | "large";
};

/** Renders a colored tag chip for resource views. */
export const Tag = ({
	children,
	color,
	as: Component = "li",
	size = "default",
}: TagProps) => (
	<Component
		className={`${styles.tag} ${size === "large" ? styles.large : ""}`}
		{...(color === undefined ? {} : { style: { backgroundColor: color } })}
	>
		{children}
	</Component>
);
