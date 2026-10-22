import type { ReactElement, ReactNode } from "react";
import styles from "./banner.module.css";

export type BannerProps = {
	leading: ReactNode;
	trailing: ReactNode;
};

/** Presents caller-owned leading and trailing banner content. */
export const Banner = ({ leading, trailing }: BannerProps): ReactElement => (
	<div className={styles.banner}>
		<div className={styles.leading}>{leading}</div>
		<div className={styles.trailing}>{trailing}</div>
	</div>
);
