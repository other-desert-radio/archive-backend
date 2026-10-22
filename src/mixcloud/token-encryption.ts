import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Tokens use a versioned AES-256-GCM envelope bound to their archive owner. */
export const createTokenEncryption = (encodedKey: string) => {
	const key = Buffer.from(encodedKey, "base64");
	if (key.length !== 32 || key.toString("base64") !== encodedKey)
		throw new Error("Invalid Mixcloud encryption key");
	return {
		encrypt(token: string, userId: string): string {
			if (!token.trim() || !userId)
				throw new Error("Invalid Mixcloud token input");
			const iv = randomBytes(12);
			const cipher = createCipheriv("aes-256-gcm", key, iv);
			cipher.setAAD(Buffer.from(`mixcloud:v1:${userId}`));
			const ciphertext = Buffer.concat([
				cipher.update(token, "utf8"),
				cipher.final(),
			]);
			return [
				"v1",
				iv.toString("base64"),
				cipher.getAuthTag().toString("base64"),
				ciphertext.toString("base64"),
			].join(".");
		},
		decrypt(envelope: string, userId: string): string {
			try {
				const [version, ivText, tagText, ciphertextText, extra] =
					envelope.split(".");
				if (
					version !== "v1" ||
					!ivText ||
					!tagText ||
					!ciphertextText ||
					extra !== undefined ||
					!userId
				)
					throw new Error("Invalid envelope");
				const iv = Buffer.from(ivText, "base64");
				const tag = Buffer.from(tagText, "base64");
				const ciphertext = Buffer.from(ciphertextText, "base64");
				if (
					iv.length !== 12 ||
					tag.length !== 16 ||
					iv.toString("base64") !== ivText ||
					tag.toString("base64") !== tagText ||
					ciphertext.toString("base64") !== ciphertextText
				)
					throw new Error("Invalid envelope");
				const decipher = createDecipheriv("aes-256-gcm", key, iv);
				decipher.setAAD(Buffer.from(`mixcloud:v1:${userId}`));
				decipher.setAuthTag(tag);
				return Buffer.concat([
					decipher.update(ciphertext),
					decipher.final(),
				]).toString("utf8");
			} catch {
				throw new Error("Unable to decrypt Mixcloud token");
			}
		},
	};
};
