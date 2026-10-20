import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";
import { setupPublicationCredentials } from "../../scripts/lib/index.js";

const directories: string[] = [];
afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});
const fixture = () => {
	const directory = mkdtempSync(path.join(tmpdir(), "credential-setup-"));
	directories.push(directory);
	const root = path.join(directory, "backend");
	mkdirSync(root);
	const dotenv =
		"# keep this comment\nUNCHANGED=keep-me\nARCHIVE_DEPLOY_KEY_PATH=\nARCHIVE_KNOWN_HOSTS_PATH=\n";
	writeFileSync(path.join(root, ".env"), dotenv);
	const hostKey = path.join(directory, "host_key");
	execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", hostKey]);
	const knownHosts = `github.com ${readFileSync(`${hostKey}.pub`, "utf8")}`;
	const environment: NodeJS.ProcessEnv = {
		ARCHIVE_RUNTIME_UID: String(process.getuid?.()),
		ARCHIVE_DEPLOY_KEY_PATH: "",
		ARCHIVE_KNOWN_HOSTS_PATH: "",
		ARCHIVE_SITE_REPOSITORY: "git@github.com:example/archive.git",
	};
	const printed: string[] = [];
	const commands: string[] = [];
	const options = {
		root,
		environment,
		interactive: true,
		print: (message: string) => {
			printed.push(message);
		},
		run: (command: string, args: string[]) => {
			commands.push(command);
			return command === "ssh-keyscan"
				? knownHosts
				: execFileSync(command, args, {
						encoding: "utf8",
						stdio: ["ignore", "pipe", "pipe"],
					});
		},
	};
	const setup = (answers = ["", "added", "verified"]) =>
		setupPublicationCredentials({
			...options,
			ask: async () => answers.shift() ?? "q",
		});
	return {
		root,
		directory,
		dotenv,
		options,
		setup,
		environment,
		printed,
		commands,
	};
};

test("blank paths generate a real dedicated key, print only the public key, and persist paths after confirmations", async () => {
	const { root, setup, environment, printed } = fixture();
	await setup();
	const expectedDirectory = path.resolve(root, "../backend-publication-ssh");
	expect(environment.ARCHIVE_DEPLOY_KEY_PATH).toBe(
		path.join(expectedDirectory, "id_ed25519"),
	);
	expect(statSync(environment.ARCHIVE_DEPLOY_KEY_PATH ?? "").mode & 0o777).toBe(
		0o600,
	);
	const publicKey = execFileSync(
		"ssh-keygen",
		["-y", "-P", "", "-f", environment.ARCHIVE_DEPLOY_KEY_PATH ?? ""],
		{ encoding: "utf8" },
	).trim();
	expect(printed.join("\n")).toContain(publicKey);
	expect(printed.join("\n")).not.toContain("PRIVATE KEY");
	const dotenv = readFileSync(path.join(root, ".env"), "utf8");
	expect(dotenv).toContain("# keep this comment\nUNCHANGED=keep-me");
	expect(parseEnv(dotenv).ARCHIVE_DEPLOY_KEY_PATH).toBe(
		environment.ARCHIVE_DEPLOY_KEY_PATH,
	);
	expect(parseEnv(dotenv).ARCHIVE_KNOWN_HOSTS_PATH).toBe(
		environment.ARCHIVE_KNOWN_HOSTS_PATH,
	);
});

test("setup waits for GitHub registration before host scanning or dotenv persistence", async () => {
	const { root, options, commands, dotenv } = fixture();
	let confirm: (answer: string) => void = () => {};
	let reached: () => void = () => {};
	const atRegistration = new Promise<void>((resolve) => {
		reached = resolve;
	});
	const registration = new Promise<string>((resolve) => {
		confirm = resolve;
	});
	const task = setupPublicationCredentials({
		...options,
		ask: async (question) => {
			if (question.includes('type "added"')) {
				reached();
				return registration;
			}
			return question.includes('"verified"') ? "verified" : "";
		},
	});
	await atRegistration;
	expect(commands).not.toContain("ssh-keyscan");
	expect(readFileSync(path.join(root, ".env"), "utf8")).toBe(dotenv);
	confirm("added");
	await task;
	expect(commands).toContain("ssh-keyscan");
});

test("unattended setup never generates credentials or auto-confirms GitHub registration", async () => {
	const { options, commands } = fixture();
	await expect(
		setupPublicationCredentials({
			...options,
			interactive: false,
			ask: async () => "added",
		}),
	).rejects.toThrow("--yes cannot confirm");
	expect(commands).toHaveLength(0);
});

test("existing configured paths require no generation or registration prompts", async () => {
	const { options, commands, environment } = fixture();
	environment.ARCHIVE_DEPLOY_KEY_PATH = "/existing/key";
	environment.ARCHIVE_KNOWN_HOSTS_PATH = "/existing/known_hosts";
	await setupPublicationCredentials({
		...options,
		interactive: false,
		ask: async () => {
			throw new Error("Unexpected prompt");
		},
	});
	expect(commands).toHaveLength(0);
});

test("registration cancellation preserves the key and reuses it on the next attempt", async () => {
	const { setup, root, dotenv } = fixture();
	await expect(setup(["", "q"])).rejects.toThrow(
		"registration was not confirmed",
	);
	const key = path.resolve(root, "../backend-publication-ssh/id_ed25519");
	const before = readFileSync(key, "utf8");
	expect(readFileSync(path.join(root, ".env"), "utf8")).toBe(dotenv);
	await setup();
	expect(readFileSync(key, "utf8")).toBe(before);
});

test("unverified host keys are not saved or configured", async () => {
	const { setup, root, dotenv } = fixture();
	await expect(setup(["", "added", "no"])).rejects.toThrow(
		"SSH host identity was not confirmed",
	);
	expect(
		existsSync(path.resolve(root, "../backend-publication-ssh/known_hosts")),
	).toBe(false);
	expect(readFileSync(path.join(root, ".env"), "utf8")).toBe(dotenv);
});

test("credential location rejects repository paths and symlinks back into the repository", async () => {
	const { setup, root, directory, commands } = fixture();
	await expect(setup(["./credentials"])).rejects.toThrow("outside the backend");
	const alias = path.join(directory, "alias");
	symlinkSync(root, alias);
	await expect(setup(["../alias/credentials"])).rejects.toThrow(
		"resolve outside",
	);
	expect(commands).toHaveLength(0);
});

test("custom credential directory with spaces is saved without damaging unrelated dotenv values", async () => {
	const { setup, directory, environment, root } = fixture();
	await setup(["../publisher keys", "added", "verified"]);
	expect(environment.ARCHIVE_DEPLOY_KEY_PATH).toBe(
		path.join(directory, "publisher keys/id_ed25519"),
	);
	expect(
		parseEnv(readFileSync(path.join(root, ".env"), "utf8")).UNCHANGED,
	).toBe("keep-me");
});
