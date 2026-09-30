import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { type Kysely, sql } from "kysely";
import { isMatching, P } from "ts-pattern";
import type { Database } from "../db/types.js";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./create-auth.js";

/** Safe operator-facing failures; database exceptions must never be printed by the CLI. */
export class AccountOperationError extends Error {}

export const normalizeAccountEmail = (email: string): string => {
	const normalized = email.trim().toLowerCase();
	if (!isMatching(P.string.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/), normalized))
		throw new AccountOperationError("A valid email address is required.");
	return normalized;
};

export const validateAccountPassword = (password: string): void => {
	if (
		password.length < PASSWORD_MIN_LENGTH ||
		password.length > PASSWORD_MAX_LENGTH
	)
		throw new AccountOperationError(
			`Password must contain ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`,
		);
};

/** Creates only an admin credential account. Duplicate identities are never overwritten. */
export const createAdminAccount = async (
	database: Kysely<Database>,
	input: { email: string; name: string; password: string },
) => {
	const email = normalizeAccountEmail(input.email);
	const name = input.name.trim();
	if (!isMatching(P.string.minLength(1), name))
		throw new AccountOperationError("Name is required.");
	validateAccountPassword(input.password);
	const password = await hashPassword(input.password);
	return database.transaction().execute(async (transaction) => {
		await sql`select pg_advisory_xact_lock(hashtext(${email}))`.execute(
			transaction,
		);
		const existing = await transaction
			.selectFrom("user")
			.select("id")
			.where(sql<string>`lower(trim(email))`, "=", email)
			.executeTakeFirst();
		if (existing)
			throw new AccountOperationError(
				"An account with this email already exists.",
			);
		const id = randomUUID();
		const now = new Date();
		await transaction
			.insertInto("user")
			.values({
				id,
				email,
				name,
				emailVerified: false,
				image: null,
				role: "admin",
				createdAt: now,
				updatedAt: now,
			})
			.execute();
		await transaction
			.insertInto("account")
			.values({
				id: randomUUID(),
				accountId: id,
				providerId: "credential",
				userId: id,
				password,
				createdAt: now,
				updatedAt: now,
				accessToken: null,
				refreshToken: null,
				idToken: null,
				accessTokenExpiresAt: null,
				refreshTokenExpiresAt: null,
				scope: null,
			})
			.execute();
		return { id, email, name };
	});
};

/** Resets an existing admin credential and revokes all its sessions in one transaction. */
export const resetAdminPassword = async (
	database: Kysely<Database>,
	input: { email: string; password: string },
) => {
	const email = normalizeAccountEmail(input.email);
	validateAccountPassword(input.password);
	const password = await hashPassword(input.password);
	return database.transaction().execute(async (transaction) => {
		const users = await transaction
			.selectFrom("user")
			.select(["id", "role"])
			.where(sql<string>`lower(trim(email))`, "=", email)
			.forUpdate()
			.execute();
		const user = users[0];
		if (users.length !== 1 || !user || user.role !== "admin")
			throw new AccountOperationError(
				"Exactly one existing admin account is required.",
			);
		const accounts = await transaction
			.selectFrom("account")
			.select("id")
			.where("userId", "=", user.id)
			.where("providerId", "=", "credential")
			.execute();
		const account = accounts[0];
		if (accounts.length !== 1 || !account)
			throw new AccountOperationError(
				"Exactly one password credential is required.",
			);
		await transaction
			.updateTable("account")
			.set({ password, updatedAt: new Date() })
			.where("id", "=", account.id)
			.execute();
		const result = await transaction
			.deleteFrom("session")
			.where("userId", "=", user.id)
			.executeTakeFirst();
		return { id: user.id, revokedSessions: Number(result.numDeletedRows) };
	});
};
