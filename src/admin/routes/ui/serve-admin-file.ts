import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
export const serveAdminFile = async (
	adminUiRoot: string,
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	const wildcard = (request.params as { "*"?: string })["*"];
	const relativePath = wildcard || "index.html";
	const filePath = resolve(adminUiRoot, relativePath);

	if (
		filePath !== adminUiRoot &&
		!filePath.startsWith(`${adminUiRoot}${sep}`)
	) {
		return reply.code(404).send({ error: "Not Found" });
	}

	try {
		const file = await readFile(filePath);
		return reply.type(contentTypeFor(filePath)).send(file);
	} catch (error) {
		request.log.error(error, "Unable to load admin UI asset");
		return reply.code(wildcard ? 404 : 503).send({
			error: wildcard ? "Not Found" : "Admin UI is unavailable",
		});
	}
};
const contentTypeFor = (filePath: string): string => {
	switch (extname(filePath)) {
		case ".css":
			return "text/css";
		case ".js":
			return "application/javascript";
		case ".svg":
			return "image/svg+xml";
		case ".json":
			return "application/json";
		default:
			return "text/html";
	}
};
