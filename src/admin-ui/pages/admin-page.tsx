import { useEffect, useState } from "react";
import { ManagementShell } from "../components/management-shell.js";
import { DJsPage } from "./djs-page.js";
import { ShowsPage } from "./shows-page.js";

export const AdminPage = () => {
	const [resource, setResource] = useState<"shows" | "djs">(
		window.location.hash === "#djs" ? "djs" : "shows",
	);

	useEffect(() => {
		const handleHashChange = () => {
			setResource(window.location.hash === "#djs" ? "djs" : "shows");
		};
		window.addEventListener("hashchange", handleHashChange);
		return () => window.removeEventListener("hashchange", handleHashChange);
	}, []);

	return (
		<ManagementShell activeResource={resource}>
			{resource === "shows" ? <ShowsPage /> : <DJsPage />}
		</ManagementShell>
	);
};
