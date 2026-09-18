import type { FastifyRequest } from "fastify";

/** Returns a short browser label suitable for request logs. */
export const clientDescription = (request: FastifyRequest): string => {
	const userAgent = request.headers["user-agent"] ?? "unknown client";
	const browser = userAgent.match(/(Edg|Chrome|Firefox|Version)\/([\d.]+)/i);

	if (browser === null) return userAgent.slice(0, 80);

	const browserToken = browser[1];
	const browserVersion = browser[2];
	if (browserToken === undefined || browserVersion === undefined) {
		return userAgent.slice(0, 80);
	}

	const browserName =
		browserToken.toLowerCase() === "edg"
			? "edge"
			: browserToken.toLowerCase() === "version"
				? "safari"
				: browserToken.toLowerCase();
	return `${browserName} ${browserVersion}`;
};
