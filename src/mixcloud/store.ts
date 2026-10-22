import { createHash, randomBytes } from "node:crypto";
import { type Kysely, sql } from "kysely";
import type { Database } from "../db/types.js";
import type { MixcloudIdentity } from "./client.js";
import { createTokenEncryption } from "./token-encryption.js";

type Owner = { userId: string; sessionId: string };
type AuthorizedConnection = { identity: MixcloudIdentity; accessToken: string };

export type MixcloudStore = {
	/** Read the connected account identity without exposing its token. */
	getConnection: (userId: string) => Promise<MixcloudIdentity | undefined>;
	/** Decrypt the token for server-side API calls; undefined means disconnected. */
	getAccessToken: (userId: string) => Promise<string | undefined>;
	/** Store a session-bound, ten-minute attempt; return raw state for the consent URL. */
	createAttempt: (owner: Owner) => Promise<string>;
	/**
	 * Consume a valid attempt, run token exchange/identity lookup, and save the
	 * encrypted connection while holding the user's lock. The callback must use
	 * bounded requests and must not call this store recursively.
	 * Returns false for an invalid attempt/session. Provider errors propagate after
	 * consuming the attempt; database errors roll back. Existing connections survive
	 * failures. Owner IDs must come from the authenticated archive session.
	 */
	completeAuthorization: (
		owner: Owner,
		state: string,
		authorize: () => Promise<AuthorizedConnection>,
	) => Promise<boolean>;
	/** Delete the connection and pending attempts, serialized with completion. */
	disconnect: (userId: string) => Promise<void>;
};

/** All connection mutations lock the user row, including while OAuth completes. */
export const createMixcloudStore = (
	database: Kysely<Database>,
	encryptionKey: string,
): MixcloudStore => {
	const encryption = createTokenEncryption(encryptionKey);
	const hashState = (state: string) =>
		createHash("sha256").update(state).digest("hex");
	return {
		async getConnection(userId: string): Promise<MixcloudIdentity | undefined> {
			const row = await database
				.selectFrom("mixcloud_connections")
				.select(["mixcloud_key", "display_name"])
				.where("user_id", "=", userId)
				.executeTakeFirst();
			return row
				? { key: row.mixcloud_key, displayName: row.display_name }
				: undefined;
		},
		async getAccessToken(userId: string): Promise<string | undefined> {
			const row = await database
				.selectFrom("mixcloud_connections")
				.select("access_token_encrypted")
				.where("user_id", "=", userId)
				.executeTakeFirst();
			return row
				? encryption.decrypt(row.access_token_encrypted, userId)
				: undefined;
		},
		async createAttempt({ userId, sessionId }: Owner): Promise<string> {
			return database.transaction().execute(async (tx) => {
				await tx
					.selectFrom("user")
					.select("id")
					.where("id", "=", userId)
					.forUpdate()
					.executeTakeFirstOrThrow();
				const session = await tx
					.selectFrom("session")
					.select("id")
					.where("id", "=", sessionId)
					.where("userId", "=", userId)
					.where("expiresAt", ">", sql<Date>`CURRENT_TIMESTAMP`)
					.executeTakeFirst();
				if (!session)
					throw new Error("Mixcloud authorization session is invalid");
				await tx
					.deleteFrom("mixcloud_oauth_attempts")
					.where("user_id", "=", userId)
					.where("expires_at", "<=", sql<Date>`CURRENT_TIMESTAMP`)
					.execute();
				const state = randomBytes(32).toString("base64url");
				await tx
					.insertInto("mixcloud_oauth_attempts")
					.values({
						state_hash: hashState(state),
						user_id: userId,
						session_id: sessionId,
						expires_at: sql<Date>`CURRENT_TIMESTAMP + interval '10 minutes'`,
					})
					.execute();
				return state;
			});
		},
		/** Attempt -> locked exchange/identity lookup -> encrypted upsert; provider rejection consumes attempt. */
		async completeAuthorization(
			{ userId, sessionId }: Owner,
			state: string,
			authorize: () => Promise<AuthorizedConnection>,
		): Promise<boolean> {
			let failure: { error: unknown } | undefined;
			const completed = await database.transaction().execute(async (tx) => {
				const user = await tx
					.selectFrom("user")
					.select("id")
					.where("id", "=", userId)
					.forUpdate()
					.executeTakeFirst();
				if (!user) return false;
				const attempt = await tx
					.deleteFrom("mixcloud_oauth_attempts")
					.where("state_hash", "=", hashState(state))
					.where("user_id", "=", userId)
					.where("session_id", "=", sessionId)
					.returning("expires_at")
					.executeTakeFirst();
				if (!attempt || attempt.expires_at.getTime() <= Date.now())
					return false;
				const session = await tx
					.selectFrom("session")
					.select("id")
					.where("id", "=", sessionId)
					.where("userId", "=", userId)
					.where("expiresAt", ">", sql<Date>`clock_timestamp()`)
					.executeTakeFirst();
				if (!session) return false;
				let connection: AuthorizedConnection;
				try {
					connection = await authorize();
				} catch (error) {
					// Commit deletion even when the provider rejects; preserve the old connection.
					failure = { error };
					return false;
				}
				const active = await tx
					.selectFrom("session")
					.select("id")
					.where("id", "=", sessionId)
					.where("expiresAt", ">", sql<Date>`clock_timestamp()`)
					.forShare()
					.executeTakeFirst();
				if (!active) return false;
				await tx
					.insertInto("mixcloud_connections")
					.values({
						user_id: userId,
						mixcloud_key: connection.identity.key,
						display_name: connection.identity.displayName,
						access_token_encrypted: encryption.encrypt(
							connection.accessToken,
							userId,
						),
					})
					.onConflict((oc) =>
						oc.column("user_id").doUpdateSet((eb) => ({
							mixcloud_key: eb.ref("excluded.mixcloud_key"),
							display_name: eb.ref("excluded.display_name"),
							access_token_encrypted: eb.ref("excluded.access_token_encrypted"),
							updated_at: sql<Date>`clock_timestamp()`,
						})),
					)
					.execute();
				return true;
			});
			if (failure) throw failure.error;
			return completed;
		},
		async disconnect(userId: string): Promise<void> {
			await database.transaction().execute(async (tx) => {
				await tx
					.selectFrom("user")
					.select("id")
					.where("id", "=", userId)
					.forUpdate()
					.executeTakeFirst();
				await tx
					.deleteFrom("mixcloud_oauth_attempts")
					.where("user_id", "=", userId)
					.execute();
				await tx
					.deleteFrom("mixcloud_connections")
					.where("user_id", "=", userId)
					.execute();
			});
		},
	};
};
