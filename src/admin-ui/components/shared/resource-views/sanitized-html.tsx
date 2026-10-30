/** Archive HTML is sanitized by the authenticated API before rendering. */
export const SanitizedHTML = ({ html }: { html: string }) => (
	// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized by the authenticated API.
	<div dangerouslySetInnerHTML={{ __html: html }} />
);
