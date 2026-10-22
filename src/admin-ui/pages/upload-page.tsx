import type { ReactElement } from "react";
import { Banner } from "../components/shared/resource-views/index.js";
import styles from "../components/shared/resource-views/resource-view/resource-view.module.css";

/** Owns the Mixcloud upload page presentation. */
export const UploadPage = (): ReactElement => (
	<section className={styles.view}>
		<header className={styles.header}>
			<h1>MIXCLOUD UPLOAD</h1>
		</header>
		<Banner
			leading={
				<p>
					You are not currently signed into mixcloud. Sign in to mixcloud to
					begin uploading a show.
				</p>
			}
			trailing={undefined}
		/>
	</section>
);
