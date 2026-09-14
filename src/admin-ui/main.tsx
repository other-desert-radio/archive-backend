import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const AdminShell = () => (
	<main className="admin-shell">
		<p className="eyebrow">Archive</p>
		<h1>Admin</h1>
		<p className="status">Working</p>
	</main>
);

createRoot(document.getElementById("root") as HTMLElement).render(
	<StrictMode>
		<AdminShell />
	</StrictMode>,
);
