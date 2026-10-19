import { APIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import type { TypedDatabase } from "../admin/routes/types.js";
import type { UserSummary } from "../admin/routes/users/types.js";
import { AccountError, getAccountSession } from "./access.js";
import {
	type ArchiveAuth,
	createAuth,
	maximumPasswordLength,
	minimumPasswordLength,
} from "./auth.js";
import { consumeAccountRateLimit, lockAccountManagement } from "./security.js";

export const safeUserColumns = [
	"id",
	"email",
	"role",
	"mustChangePassword",
] as const;
export const validatePassword = (password: unknown): string => {
	if (
		typeof password !== "string" ||
		password.length < minimumPasswordLength ||
		password.length > maximumPasswordLength
	)
		throw new AccountError(
			400,
			`Password must be ${minimumPasswordLength}–${maximumPasswordLength} characters`,
		);
	return password;
};
export const normalizeAccountEmail = (value: unknown): string => {
	if (typeof value !== "string")
		throw new AccountError(400, "A valid email is required");
	const email = value.trim().toLowerCase();
	if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		throw new AccountError(400, "A valid email is required");
	return email;
};
export const accountRolePattern = P.union("admin", "editor");
export const requireAccountBody = (body: unknown): Record<string, unknown> => {
	if (!isMatching(P.record(P.string, P.unknown), body))
		throw new AccountError(400, "Invalid request body");
	return body;
};
export const requireAccountId = (id: unknown): string => {
	if (typeof id !== "string" || !id.trim())
		throw new AccountError(400, "Account ID is required");
	return id;
};

/** All management decisions and Better Auth writes share this transaction. */
export const mutateAccounts = async <T>(
	database: TypedDatabase,
	request: FastifyRequest,
	operation: (
		transaction: TypedDatabase,
		auth: ArchiveAuth,
		actorId: string,
	) => Promise<T>,
): Promise<T> => {
	if (!(await consumeAccountRateLimit(database, request.ip)))
		throw new AccountError(
			429,
			"Too many account requests. Please try again shortly",
		);
	return database.transaction().execute(async (transaction) => {
		await lockAccountManagement(transaction);
		const scopedAuth = createAuth(transaction);
		const session = await getAccountSession(scopedAuth, request);
		if (session.user.role !== "admin") throw new AccountError(403, "Forbidden");
		request.log.info(
			{ actorId: session.user.id },
			`[Accounts] management authorized -- actor: ${session.user.id}`,
		);
		return operation(transaction, scopedAuth, session.user.id);
	});
};

export const findManagedUser = async (
	database: TypedDatabase,
	id: string,
): Promise<UserSummary> => {
	const user = await database
		.selectFrom("user")
		.select(safeUserColumns)
		.where("id", "=", id)
		.executeTakeFirst();
	if (!user) throw new AccountError(404, "Account not found");
	return user;
};
export const protectAdministrator = async (
	database: TypedDatabase,
	target: UserSummary,
	actorId: string,
): Promise<void> => {
	if (target.id === actorId)
		throw new AccountError(400, "You cannot delete or demote your own account");
	if (target.role === "admin") {
		const admins = await database
			.selectFrom("user")
			.select("id")
			.where("role", "=", "admin")
			.execute();
		if (admins.length <= 1)
			throw new AccountError(
				409,
				"The last administrator cannot be removed or demoted",
			);
	}
};
export const accountHeaders = (request: FastifyRequest): Headers =>
	fromNodeHeaders(request.headers);

export const sendAccountError = (
	error: unknown,
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	if (error instanceof AccountError) {
		request.log.warn(
			{ status: error.status },
			`[Accounts] request rejected -- status: ${error.status}, reason: ${error.message}`,
		);
		return reply.code(error.status).send({
			error: error.message,
			...(error.code ? { code: error.code } : {}),
		});
	}
	if (error instanceof APIError && error.statusCode < 500) {
		// Library errors are deliberately mapped without returning internal objects.
		const message =
			error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
				? "An account with that email already exists"
				: error.body?.code === "INVALID_PASSWORD"
					? "Current password is incorrect"
					: "Account request was rejected";
		request.log.warn(
			{ status: error.statusCode, code: error.body?.code },
			"[Accounts] library request rejected",
		);
		return reply.code(error.statusCode).send({ error: message });
	}
	if (isMatching({ code: "23505" }, error))
		return reply
			.code(409)
			.send({ error: "An account with that email already exists" });
	request.log.error({ err: error }, "[Accounts] request failed");
	return reply.code(500).send({ error: "Unable to complete account request" });
};
