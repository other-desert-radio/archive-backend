import type { PublicationConfig } from "./types.js";
export const readPublicationConfig = (
	_environment: NodeJS.ProcessEnv,
	_repositoryRoot: string,
): PublicationConfig => {
	throw new Error("Not implemented: readPublicationConfig");
};
