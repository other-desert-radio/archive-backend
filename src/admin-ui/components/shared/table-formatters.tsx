import type { ReactNode } from "react";

export const formatMissing = (value: ReactNode | undefined) =>
	value === undefined ? <span className="muted">None</span> : value;
export const formatRelationshipIDs = (ids: number[]) =>
	ids.length === 0 ? <span className="muted">None</span> : ids.join(", ");
export const formatUTCDateTime = (value: string) => {
	const iso = new Date(value).toISOString();
	return `${iso.slice(0, 19).replace("T", " ")} UTC`;
};
