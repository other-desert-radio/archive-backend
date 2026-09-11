import { betterAuth } from "better-auth";
import { pool } from "../db/db.js";

const authSecret = process.env.BETTER_AUTH_SECRET;
const authUrl = process.env.BETTER_AUTH_URL;

if (!authSecret) {
	throw new Error("BETTER_AUTH_SECRET is required");
}

if (!authUrl) {
	throw new Error("BETTER_AUTH_URL is required");
}

export const auth = betterAuth({
	secret: authSecret,
	baseURL: authUrl,
	database: pool,
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
	},
});
