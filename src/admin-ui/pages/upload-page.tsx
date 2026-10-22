import type { ReactElement } from "react";
import styles from "../components/shared/resource-views/resource-view/resource-view.module.css";

/** Owns the Mixcloud upload page presentation. */
export const UploadPage = (): ReactElement => (
	<section className={styles.view}>
		<header className={styles.header}>
			<h1>MIXCLOUD UPLOAD</h1>
		</header>
	</section>
);
