import { execFileSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";

type CredentialSetupOptions = {
	root: string;
	environment: NodeJS.ProcessEnv;
	interactive: boolean;
	ask: (question: string) => Promise<string>;
	print: (message: string) => void;
	run?: (command: string, args: string[]) => string;
};

const execute = (command: string, args: string[]): string =>
	execFileSync(command, args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 30000,
	});

const outsideRepository = (root: string, location: string): boolean => {
	const relative = path.relative(root, location);
	return relative === ".." || relative.startsWith(`..${path.sep}`);
};

/** Generate missing publication credentials; human approval gates registration and trust. */
export const setupPublicationCredentials = async ({
	root,
	environment,
	interactive,
	ask,
	print,
	run = execute,
}: CredentialSetupOptions): Promise<void> => {
	const keySetting = environment.ARCHIVE_DEPLOY_KEY_PATH?.trim();
	const hostsSetting = environment.ARCHIVE_KNOWN_HOSTS_PATH?.trim();
	if (keySetting && hostsSetting) return;
	if (!interactive)
		throw new Error(
			"SSH paths are empty. Run scripts/setup-server in a terminal to generate credentials and confirm GitHub registration; --yes cannot confirm these steps.",
		);
	if (Number(environment.ARCHIVE_RUNTIME_UID) !== process.getuid?.())
		throw new Error(
			"Run credential generation as the service account matching ARCHIVE_RUNTIME_UID so the new private key has the correct owner.",
		);
	const defaultDirectory = keySetting
		? path.dirname(path.resolve(root, keySetting))
		: path.resolve(root, "..", `${path.basename(root)}-publication-ssh`);
	const response = (
		await ask(
			`Where should publication SSH credentials live? [${path.relative(root, defaultDirectory)}]: `,
		)
	).trim();
	if (response === "q")
		throw new Error(
			"Credential setup cancelled. Existing files were preserved.",
		);
	const directory = path.resolve(root, response || defaultDirectory);
	if (
		Array.from(directory).some(
			(character) =>
				character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
		) ||
		!outsideRepository(root, directory)
	)
		throw new Error(
			"Credential directory must be outside the backend repository and contain no control characters.",
		);
	// Resolve existing ancestors before making directories to reject symlink redirection.
	let ancestor = directory;
	while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
	const physicalDirectory = path.resolve(
		realpathSync(ancestor),
		path.relative(ancestor, directory),
	);
	if (!outsideRepository(realpathSync(root), physicalDirectory))
		throw new Error(
			"Credential directory must resolve outside the backend repository.",
		);
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	const key = keySetting
		? path.resolve(root, keySetting)
		: path.join(directory, "id_ed25519");
	const hosts = hostsSetting
		? path.resolve(root, hostsSetting)
		: path.join(directory, "known_hosts");
	for (const file of [key, hosts]) {
		if (existsSync(file) && lstatSync(file).isSymbolicLink())
			throw new Error("Credential files must not be symlinks.");
	}
	if (!keySetting) {
		if (!existsSync(key)) {
			if (existsSync(`${key}.pub`))
				throw new Error(
					"A public key already exists without its private key. Choose another directory; existing files were preserved.",
				);
			try {
				run("ssh-keygen", [
					"-t",
					"ed25519",
					"-N",
					"",
					"-C",
					`${path.basename(root)} publication`,
					"-f",
					key,
				]);
			} catch {
				throw new Error(
					"Could not generate the publication SSH key. Check ssh-keygen and directory permissions.",
				);
			}
		}
		let publicKey: string;
		try {
			publicKey = run("ssh-keygen", ["-y", "-P", "", "-f", key]).trim();
		} catch {
			throw new Error(
				"Existing publication key is unreadable or encrypted. It was not overwritten; choose another directory or configure an unattended key.",
			);
		}
		print(
			`\nAdd this PUBLIC key to the archive repository's Settings → Deploy keys with Allow write access:\n\n${publicKey}\n`,
		);
		const confirmation = (
			await ask(
				'After adding the key to GitHub with write access, type "added" to continue (q to stop): ',
			)
		)
			.trim()
			.toLowerCase();
		if (confirmation !== "added")
			throw new Error(
				"GitHub deploy-key registration was not confirmed. The key was preserved; setup stopped before repository access.",
			);
	}
	if (!hostsSetting) {
		const repository =
			environment.ARCHIVE_SITE_REPOSITORY ??
			"git@github.com:other-desert-radio/archive-site.git";
		const scpHost = /^[\w.-]+@([\w.-]+):/.exec(repository)?.[1];
		const url = scpHost ? undefined : new URL(repository);
		const hostname = scpHost ?? url?.hostname;
		if (!hostname || hostname.startsWith("-"))
			throw new Error(
				"Cannot determine SSH hostname from ARCHIVE_SITE_REPOSITORY. Configure a verified ARCHIVE_KNOWN_HOSTS_PATH.",
			);
		let scanned: string;
		try {
			scanned = existsSync(hosts)
				? readFileSync(hosts, "utf8")
				: run("ssh-keyscan", [
						"-T",
						"10",
						"-t",
						"ed25519",
						...(url?.port ? ["-p", url.port] : []),
						hostname,
					]);
		} catch {
			throw new Error(
				"Could not retrieve SSH host keys. Check the network or configure a verified ARCHIVE_KNOWN_HOSTS_PATH.",
			);
		}
		if (!scanned.trim())
			throw new Error(
				"No SSH host key was returned. Configure a verified ARCHIVE_KNOWN_HOSTS_PATH.",
			);
		const candidate = `${hosts}.candidate-${crypto.randomUUID()}`;
		try {
			writeFileSync(candidate, scanned, { flag: "wx", mode: 0o600 });
			const fingerprints = run("ssh-keygen", ["-lf", candidate]);
			print(
				`\nSSH host fingerprints for ${hostname}:\n${fingerprints}\nVerify these independently before trusting them.${hostname === "github.com" ? " GitHub publishes fingerprints at https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints" : ""}`,
			);
			if (
				(
					await ask(
						'Type "verified" after checking the fingerprints (q to stop): ',
					)
				)
					.trim()
					.toLowerCase() !== "verified"
			)
				throw new Error(
					"SSH host identity was not confirmed. No known_hosts file was trusted.",
				);
			if (!existsSync(hosts))
				writeFileSync(hosts, scanned, { flag: "wx", mode: 0o600 });
		} finally {
			unlinkSync(candidate);
		}
	}
	const dotenvPath = path.join(root, ".env");
	const lines = readFileSync(dotenvPath, "utf8").split("\n");
	for (const [name, value] of [
		["ARCHIVE_DEPLOY_KEY_PATH", key],
		["ARCHIVE_KNOWN_HOSTS_PATH", hosts],
	] as const) {
		let found = false;
		for (let index = 0; index < lines.length; index++) {
			if (
				new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(lines[index] ?? "")
			) {
				lines[index] = `${name}=${JSON.stringify(value)}`;
				found = true;
			}
		}
		if (!found) lines.push(`${name}=${JSON.stringify(value)}`);
		environment[name] = value;
	}
	writeFileSync(dotenvPath, lines.join("\n"));
	print(
		"Saved publication SSH paths to .env. Private key contents were not printed.",
	);
};
