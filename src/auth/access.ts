import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ArchiveAuth } from "./auth.js";

export class AccountError extends Error {
	constructor(
		readonly status: 400 | 401 | 403 | 404 | 409 | 429,
		message: string,
		readonly code?: string,
	) {
		super(message);
	}
}

export const getAccountSession = async (
	auth: ArchiveAuth,
	request: FastifyRequest,
	allowPasswordChange = false,
) => {
	const session = await auth.api.getSession({
		headers: fromNodeHeaders(request.headers),
	});
	if (!session?.user) throw new AccountError(401, "Unauthorized");
	if (session.user.role !== "admin" && session.user.role !== "editor")
		throw new AccountError(403, "Forbidden");
	if (!allowPasswordChange && session.user.mustChangePassword)
		throw new AccountError(
			403,
			"You must change your password before continuing",
			"PASSWORD_CHANGE_REQUIRED",
		);
	return session;
};

export const accountAccessGuard =
	(auth: ArchiveAuth, adminOnly = false) =>
	async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
		try {
			const session = await getAccountSession(auth, request);
			if (adminOnly && session.user.role !== "admin")
				throw new AccountError(403, "Forbidden");
		} catch (error) {
			if (!(error instanceof AccountError)) throw error;
			reply.code(error.status).send({
				error: error.message,
				...(error.code ? { code: error.code } : {}),
			});
		}
	};
