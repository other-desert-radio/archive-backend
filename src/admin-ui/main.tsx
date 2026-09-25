import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AdminPage } from "./pages/admin-page.js";
import "./styles.css";
import "./admin-ui.module.css";

createRoot(document.getElementById("root") as HTMLElement).render(
	<StrictMode>
		<AdminPage />
	</StrictMode>,
);
