import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PublicationConfig } from "../types.js";

const executeFile = promisify(execFile);

/** Use argv, fixed safeguards, and sanitized errors for local and network commands. */
export const runGit = async ({
	checkout,
	args,
	operation = "inspect",
	timeout = 10000,
	identity,
}: {
	checkout: string;
	args: string[];
	operation?: string;
	timeout?: number;
	identity?: PublicationConfig["gitIdentity"];
}): Promise<string> => {
	// Ignore inherited Git overrides so every operation targets this checkout.
	const environment = Object.fromEntries(
		Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
	);
	try {
		// Apply the same hook, identity, and noninteractive safeguards to every flow.
		const { stdout } = await executeFile(
			"git",
			[
				"--no-optional-locks",
				"-c",
				`safe.directory=${checkout}`,
				"-c",
				"core.hooksPath=/dev/null",
				"-c",
				"core.fsmonitor=false",
				"-c",
				"submodule.recurse=false",
				"-c",
				"maintenance.auto=false",
				"-c",
				"gc.auto=0",
				"-C",
				checkout,
				...(identity
					? [
							"-c",
							`user.name=${identity.name}`,
							"-c",
							`user.email=${identity.email}`,
						]
					: []),
				...args,
			],
			{
				env: {
					...environment,
					GIT_CONFIG_NOSYSTEM: "1",
					GIT_CONFIG_GLOBAL: "/dev/null",
					GIT_TERMINAL_PROMPT: "0",
					GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o StrictHostKeyChecking=yes",
					LC_ALL: "C",
				},
				encoding: "utf8",
				timeout,
				maxBuffer: 1024 * 1024,
			},
		);
		return stdout.trim();
	} catch {
		// Git stderr may contain credential-bearing local configuration.
		throw new Error(`Unable to ${operation} publication checkout with Git`);
	}
};

/** Read-only callers share the same safeguards as fetch, commit, and push. */
export const inspectGit = (checkout: string, args: string[]): Promise<string> =>
	runGit({ checkout, args });

/** Parse Git -z path output without treating spaces or newlines as separators. */
export const pathsFromGit = (output: string): string[] =>
	output.split("\0").filter(Boolean);
