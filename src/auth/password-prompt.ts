import { emitKeypressEvents } from "node:readline";
import { AccountOperationError } from "./operator-accounts.js";

/** Reads a password without echo, masking, shell arguments, or environment variables. */
export const promptPassword = (label: string): Promise<string> => {
	const input = process.stdin;
	const output = process.stderr;
	if (!input.isTTY || !output.isTTY)
		throw new AccountOperationError(
			"An interactive terminal is required for hidden password entry.",
		);
	return new Promise((resolve, reject) => {
		const wasRaw = input.isRaw;
		const wasFlowing = input.readableFlowing === true;
		let password = "";
		const cleanup = () => {
			input.off("keypress", onKey);
			input.off("error", onError);
			input.setRawMode(wasRaw);
			if (!wasFlowing) input.pause();
			output.write("\n");
		};
		const onError = () => {
			cleanup();
			reject(new AccountOperationError("Password entry failed."));
		};
		const onKey = (
			text: string | undefined,
			key: { name?: string; ctrl?: boolean; meta?: boolean },
		) => {
			if (key.ctrl && (key.name === "c" || key.name === "d")) {
				cleanup();
				reject(
					new AccountOperationError("Cancelled; no account changes were made."),
				);
			} else if (key.name === "return" || key.name === "enter") {
				cleanup();
				resolve(password);
			} else if (key.name === "backspace") {
				password = Array.from(password).slice(0, -1).join("");
			} else if (
				!key.ctrl &&
				!key.meta &&
				text &&
				Array.from(text).every((character) => {
					const code = character.codePointAt(0) ?? 0;
					return code >= 32 && code !== 127;
				})
			) {
				password += text;
			}
		};
		emitKeypressEvents(input);
		input.setRawMode(true);
		input.on("keypress", onKey);
		input.on("error", onError);
		output.write(label);
		input.resume();
	});
};
