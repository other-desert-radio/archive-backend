import { isAbsolute, relative, resolve, sep } from "node:path";
import { isMatching, match, P } from "ts-pattern";
import type { PublicationConfig } from "./types.js";

const readEnvSetting = ({
	environment,
	name,
	fallback,
}: {
	environment: NodeJS.ProcessEnv;
	name: string;
	fallback: string;
}): string => {
	const value = (environment[name] ?? fallback).trim();
	if (
		!isMatching(P.string.minLength(1), value) ||
		Array.from(value).some(
			(character) =>
				character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
		)
	) {
		throw new Error(
			`${name} must be nonempty and contain no control characters`,
		);
	}
	return value;
};

const validRepository = (repository: string): boolean =>
	match(repository)
		.with(P.string.regex(/\s/), P.string.startsWith("-"), () => false)
		.with(P.string.regex(/^[\w.-]+@[\w.-]+:[\w./-]+$/), () => true)
		.otherwise((value) => {
			try {
				const url = new URL(value);
				const validTransport = match(url)
					.with(
						{ protocol: "ssh:" },
						{ protocol: "https:", username: "" },
						() => true,
					)
					.otherwise(() => false);
				return (
					validTransport &&
					isMatching(
						{
							hostname: P.string.minLength(1),
							pathname: P.string.minLength(2),
							password: "",
							search: "",
							hash: "",
						},
						url,
					)
				);
			} catch {
				return false;
			}
		});

/** Accept a conservative subset of Git branch names, without executing Git. */
const validBranch = (branch: string): boolean =>
	branch !== "HEAD" &&
	/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(branch) &&
	!branch.includes("..") &&
	branch
		.split("/")
		.every(
			(part) =>
				part.length > 0 &&
				!part.startsWith(".") &&
				!part.endsWith(".") &&
				!part.endsWith(".lock"),
		);

const containsPath = (parent: string, child: string): boolean => {
	const difference = relative(parent, child);
	return (
		difference === "" ||
		(!isAbsolute(difference) &&
			difference !== ".." &&
			!difference.startsWith(`..${sep}`))
	);
};

/** Resolve the explicitly configured checkout; never guess a publication destination. */
export const readArchiveCheckoutPath = ({
	environment,
	repositoryRoot,
}: {
	environment: NodeJS.ProcessEnv;
	repositoryRoot: string;
}): string => {
	if (!isAbsolute(repositoryRoot))
		throw new Error("Backend repository root must be absolute");
	const checkoutPath = resolve(
		repositoryRoot,
		readEnvSetting({
			environment,
			name: "ARCHIVE_CHECKOUT_PATH",
			fallback: "",
		}),
	);
	if (
		containsPath(repositoryRoot, checkoutPath) ||
		containsPath(checkoutPath, repositoryRoot)
	) {
		throw new Error(
			"ARCHIVE_CHECKOUT_PATH must be separate from the backend repository",
		);
	}
	return checkoutPath;
};

/** Parse settings only; filesystem, symlink, and Git checkout checks run before publishing. */
export const readPublicationConfig = (
	environment: NodeJS.ProcessEnv,
	repositoryRoot: string,
): PublicationConfig => {
	if (!isAbsolute(repositoryRoot))
		throw new Error("Backend repository root must be absolute");
	const mode = readEnvSetting({
		environment,
		name: "ARCHIVE_PUBLISH_MODE",
		fallback: "local",
	});
	if (!isMatching(P.union("local", "remote"), mode))
		throw new Error("ARCHIVE_PUBLISH_MODE must be local or remote");
	const checkoutPath = readArchiveCheckoutPath({ environment, repositoryRoot });
	if (mode === "local") return { mode, checkoutPath };
	const repository = readEnvSetting({
		environment,
		name: "ARCHIVE_SITE_REPOSITORY",
		fallback: "git@github.com:other-desert-radio/archive-site.git",
	});
	if (!validRepository(repository))
		throw new Error(
			"ARCHIVE_SITE_REPOSITORY must be an SSH or HTTPS remote without embedded passwords",
		);
	const branch = readEnvSetting({
		environment,
		name: "ARCHIVE_PUBLISH_BRANCH",
		fallback: "publish-dev",
	});
	if (!validBranch(branch))
		throw new Error(
			"ARCHIVE_PUBLISH_BRANCH must be a valid branch using letters, numbers, underscores, dots, slashes, or hyphens",
		);
	const gitIdentity =
		environment.ARCHIVE_GIT_NAME !== undefined ||
		environment.ARCHIVE_GIT_EMAIL !== undefined
			? {
					name: readEnvSetting({
						environment,
						name: "ARCHIVE_GIT_NAME",
						fallback: "",
					}),
					email: readEnvSetting({
						environment,
						name: "ARCHIVE_GIT_EMAIL",
						fallback: "",
					}),
				}
			: undefined;
	return {
		mode,
		repository,
		checkoutPath,
		branch,
		...(gitIdentity ? { gitIdentity } : {}),
	};
};
