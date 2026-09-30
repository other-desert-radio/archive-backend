import { betterAuth } from "better-auth";
import type { Pool } from "pg";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

type AuthConfiguration = {
	database: Pool;
	secret: string;
	baseURL: string;
	validateSchema?: boolean;
};

/** Builds runtime and test authentication without reading environment or opening a pool. */
export const createAuth = ({
	database,
	secret,
	baseURL,
	validateSchema = true,
}: AuthConfiguration) =>
	betterAuth({
		secret,
		baseURL,
		database,
		user: {
			additionalFields: {
				role: {
					type: ["admin"],
					required: false,
					defaultValue: "admin",
					input: false,
				},
			},
		},
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
			minPasswordLength: PASSWORD_MIN_LENGTH,
			maxPasswordLength: PASSWORD_MAX_LENGTH,
		},
		advanced: { database: { validateSchema } },
	});

export type AdminAuth = ReturnType<typeof createAuth>;
