import type { ShowsAdminRow } from "../../../loaders/shows.js";

/** Starting point for Show-specific grid card UI. */
export const renderShowCard = (_show: ShowsAdminRow, key: string | number) => (
	<div key={key} />
);
