import type { PublicationConfig } from "../types.js";

/** Execute Git with publication safeguards; failures omit sensitive Git stderr. */
export const runGit = async (_request: {
	checkout: string;
	args: string[];
	operation?: string;
	timeout?: number;
	identity?: PublicationConfig["gitIdentity"];
}): Promise<string> => {
	throw new Error("Not implemented: runGit");
};

/** Read Git state for validation and recovery without intentional mutations. */
export const inspectGit = async (
	_checkout: string,
	_args: string[],
): Promise<string> => {
	throw new Error("Not implemented: inspectGit");
};
