import type { ReactNode } from "react";

export const formatMissing = (value: ReactNode | undefined) =>
	value === undefined ? <span className="muted">None</span> : value;
export const formatRelationshipIDs = (ids: number[]) =>
	ids.length === 0 ? <span className="muted">None</span> : ids.join(", ");
export const formatUTCDateTime = (value: string) => {
	const iso = new Date(value).toISOString();
	return `${iso.slice(0, 19).replace("T", " ")} UTC`;
};

/** Formats a timestamp as its UTC calendar date without local-time conversion. */
export const formatUTCDate = (value: string) =>
	new Date(value).toISOString().slice(0, 10);

/** Formats a duration in seconds, retaining hours beyond a single day. */
export const formatDuration = (seconds: number) => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;
	return [hours, minutes, remainingSeconds]
		.map((value) => value.toString().padStart(2, "0"))
		.join(":");
};
