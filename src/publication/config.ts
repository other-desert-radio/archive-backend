import { isAbsolute, relative, resolve, sep } from "node:path";
import { isMatching, match, P } from "ts-pattern";
import type { PublicationConfig } from "./types.js";

const setting = ({
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

/** Parse settings only; filesystem, symlink, and Git checkout checks run before publishing. */
export const readPublicationConfig = (
	environment: NodeJS.ProcessEnv,
	repositoryRoot: string,
): PublicationConfig => {
	if (!isAbsolute(repositoryRoot))
		throw new Error("Backend repository root must be absolute");
	const enabled = setting({
		environment,
		name: "ARCHIVE_PUBLISH_ENABLED",
		fallback: "false",
	});
	if (!isMatching(P.union("true", "false"), enabled)) {
		throw new Error("ARCHIVE_PUBLISH_ENABLED must be true or false");
	}
	const repository = setting({
		environment,
		name: "ARCHIVE_SITE_REPOSITORY",
		fallback: "git@github.com:other-desert-radio/archive-site.git",
	});
	if (!validRepository(repository))
		throw new Error(
			"ARCHIVE_SITE_REPOSITORY must be an SSH or HTTPS remote without embedded passwords",
		);
	const branch = setting({
		environment,
		name: "ARCHIVE_PUBLISH_BRANCH",
		fallback: "publish-dev",
	});
	if (!validBranch(branch))
		throw new Error(
			"ARCHIVE_PUBLISH_BRANCH must be a valid branch using letters, numbers, underscores, dots, slashes, or hyphens",
		);
	const checkoutPath = resolve(
		repositoryRoot,
		setting({
			environment,
			name: "ARCHIVE_CHECKOUT_PATH",
			fallback: "../clean-archive-site",
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
	return { enabled: enabled === "true", repository, checkoutPath, branch };
};
