import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { defaultAc } from "better-auth/plugins/admin/access";
import type { TypedDatabase } from "../admin/routes/types.js";
import { db } from "../db/db.js";

const authSecret = process.env.BETTER_AUTH_SECRET;
const authUrl = process.env.BETTER_AUTH_URL;
if (!authSecret) throw new Error("BETTER_AUTH_SECRET is required");
if (!authUrl) throw new Error("BETTER_AUTH_URL is required");

const configuredAuthUrl = new URL(authUrl);
if (
	!["http:", "https:"].includes(configuredAuthUrl.protocol) ||
	configuredAuthUrl.username ||
	configuredAuthUrl.password ||
	configuredAuthUrl.pathname !== "/" ||
	configuredAuthUrl.search ||
	configuredAuthUrl.hash
)
	throw new Error("BETTER_AUTH_URL must be an HTTP(S) origin");
if (
	process.env.NODE_ENV === "production" &&
	(authSecret.length < 32 ||
		authSecret === "local-development-secret-do-not-use-in-production" ||
		authSecret === "better-auth-secret-12345678901234567890")
)
	throw new Error(
		"Production BETTER_AUTH_SECRET must be a unique random secret of at least 32 characters",
	);

export const authOrigin = configuredAuthUrl.origin;
export const trustedAuthOrigins = [
	authOrigin,
	...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
		.split(",")
		.filter(Boolean)
		.map((value) => {
			const url = new URL(value.trim());
			if (
				!["http:", "https:"].includes(url.protocol) ||
				value.trim() !== url.origin
			)
				throw new Error(
					"BETTER_AUTH_TRUSTED_ORIGINS must contain exact HTTP(S) origins",
				);
			return url.origin;
		}),
];
export const minimumPasswordLength = 8;
export const maximumPasswordLength = 128;

/** A transaction-scoped instance keeps library writes inside our safety lock. */
export const createAuth = (database: TypedDatabase = db) =>
	betterAuth({
		secret: authSecret,
		baseURL: authUrl,
		trustedOrigins: trustedAuthOrigins,
		database: { db: database, type: "postgres", transaction: false },
		plugins: [
			admin({
				defaultRole: "editor",
				adminRoles: ["admin"],
				roles: {
					admin: defaultAc.newRole({
						user: ["create", "list", "set-role", "delete", "set-password"],
						session: ["revoke"],
					}),
					editor: defaultAc.newRole({ user: [], session: [] }),
				},
			}),
		],
		user: {
			additionalFields: {
				mustChangePassword: {
					type: "boolean",
					required: true,
					defaultValue: false,
					input: false,
				},
			},
		},
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
			minPasswordLength: minimumPasswordLength,
			maxPasswordLength: maximumPasswordLength,
		},
		session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
		rateLimit: {
			enabled: true,
			storage: "database",
			window: 60,
			max: 100,
			customRules: { "/sign-in/email": { window: 60, max: 5 } },
		},
		advanced: {
			useSecureCookies: configuredAuthUrl.protocol === "https:",
			defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
			ipAddress: { ipAddressHeaders: ["x-archive-client-ip"] },
			database: {
				validateSchema:
					process.env.NODE_ENV !== "test" && !database.isTransaction,
			},
		},
	});

export const auth = createAuth();
export type ArchiveAuth = typeof auth;
