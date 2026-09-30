import { useEffect, useState } from "react";
import { ManagementShell } from "../components/layout/management-shell.js";
import { DJsPage } from "./djs-page.js";
import { MixcloudPage } from "./mixcloud-page.js";
import { ShowsPage } from "./shows-page.js";
import { TagsPage } from "./tags-page.js";

type AdminResource = "shows" | "djs" | "tags" | "mixcloud";

const getResourceFromHash = (): AdminResource => {
	if (window.location.hash === "#djs") {
		return "djs";
	}

	if (window.location.hash === "#mixcloud") return "mixcloud";

	if (window.location.hash === "#tags") {
		return "tags";
	}

	return "shows";
};

export const AdminPage = () => {
	const [resource, setResource] = useState<AdminResource>(getResourceFromHash);

	useEffect(() => {
		const handleHashChange = () => {
			setResource(getResourceFromHash());
		};
		window.addEventListener("hashchange", handleHashChange);
		return () => window.removeEventListener("hashchange", handleHashChange);
	}, []);

	return (
		<ManagementShell activeResource={resource}>
			{resource === "shows" ? (
				<ShowsPage />
			) : resource === "djs" ? (
				<DJsPage />
			) : resource === "mixcloud" ? (
				<MixcloudPage />
			) : (
				<TagsPage />
			)}
		</ManagementShell>
	);
};
