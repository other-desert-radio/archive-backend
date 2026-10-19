import { useEffect, useState } from "react";
import { ManagementShell } from "../components/layout/management-shell.js";
import type { AccountUser } from "../loaders/auth.js";
import { DJsPage } from "./djs-page.js";
import { MixcloudPage } from "./mixcloud-page.js";
import { ShowsPage } from "./shows-page.js";
import { TagsPage } from "./tags-page.js";
import { UsersPage } from "./users-page.js";

type AdminResource = "shows" | "djs" | "tags" | "mixcloud" | "users";

const getResourceFromHash = (): AdminResource => {
	if (window.location.hash === "#users") return "users";
	if (window.location.hash === "#djs") {
		return "djs";
	}

	if (window.location.hash === "#mixcloud") return "mixcloud";

	if (window.location.hash === "#tags") {
		return "tags";
	}

	return "shows";
};

export const AdminPage = ({
	user,
	onLogout,
}: {
	user: AccountUser;
	onLogout: () => Promise<void>;
}) => {
	const [resource, setResource] = useState<AdminResource>(getResourceFromHash);

	useEffect(() => {
		const handleHashChange = () => {
			setResource(getResourceFromHash());
		};
		window.addEventListener("hashchange", handleHashChange);
		return () => window.removeEventListener("hashchange", handleHashChange);
	}, []);

	return (
		<ManagementShell activeResource={resource} user={user} onLogout={onLogout}>
			{resource === "users" ? (
				user.role === "admin" ? (
					<UsersPage currentUser={user} />
				) : (
					<p role="alert">Administrator access is required.</p>
				)
			) : resource === "shows" ? (
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
