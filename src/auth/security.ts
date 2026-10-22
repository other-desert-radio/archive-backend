import type { FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import type { TypedDatabase } from "../admin/routes/types.js";
import { requestPathForLog } from "../utils/index.js";
import { trustedAuthOrigins } from "./auth.js";

/** Cookie-authenticated writes must come from the configured application. */
export const requireSameOrigin = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
	const origin = request.headers.origin;
	if (
		(origin && !trustedAuthOrigins.includes(origin)) ||
		(!origin && request.headers.cookie)
	) {
		const safeOrigin = (value: string | undefined): string => {
			if (!value) return "missing";
			try {
				return new URL(value).origin;
			} catch {
				return "invalid";
			}
		};
		request.log.warn(
			`[Authentication] request origin rejected -- method: ${request.method}, url: ${requestPathForLog(request.url)}, origin: ${safeOrigin(origin)}, expected: ${trustedAuthOrigins.join(", ")}, reference: ${request.id}`,
		);
		reply.code(403).send({ error: "Request origin is not allowed" });
	}
};

/** One database lock serializes account changes, including the bootstrap CLI. */
export const lockAccountManagement = async (
	database: TypedDatabase,
): Promise<void> => {
	await sql`select pg_advisory_xact_lock(71329, 1)`.execute(database);
};

/** Atomic fixed-window consumption for custom password/account endpoints. */
export const consumeAccountRateLimit = async (
	database: TypedDatabase,
	key: string,
): Promise<boolean> => {
	const now = Date.now();
	const result = await sql<{ count: number }>`
  insert into "rateLimit" (id, key, count, "lastRequest")
  values (${crypto.randomUUID()}, ${`account:${key}`}, 1, ${now})
  on conflict (key) do update set
   count = case when "rateLimit"."lastRequest" < ${now - 60_000} then 1 else "rateLimit".count + 1 end,
   "lastRequest" = case when "rateLimit"."lastRequest" < ${now - 60_000} then ${now} else "rateLimit"."lastRequest" end
  returning count
 `.execute(database);
	return (result.rows[0]?.count ?? 11) <= 10;
};
