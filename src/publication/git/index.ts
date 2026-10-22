/**
 * Git publication flow used by the runner:
 * validate → reconcile retry → synchronize → export (runner) → commit/push.
 * The runner acknowledges the captured revision only after confirmed success.
 * Internal modules use direct imports so the public barrel creates no cycles.
 */

export { inspectGit, pathsFromGit, readGitBytes } from "./commands.js";
export { commitAndPushPublication, generatedPath } from "./commits.js";
export { reconcilePublicationGit } from "./recovery.js";
export {
	fetchPublicationBranch,
	synchronizePublicationCheckout,
} from "./remote.js";
export type {
	PublicationGitContext,
	PublicationGitResult,
	PublicationRecovery,
} from "./types.js";
export { validatePublicationCheckout } from "./validation.js";
