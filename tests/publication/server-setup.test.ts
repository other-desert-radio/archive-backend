import { afterEach, expect, test } from "bun:test";
import {
	chmod,
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});
const fixture = async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "server-setup-"));
	directories.push(directory);
	const root = path.join(directory, "backend");
	const bin = path.join(directory, "bin");
	await mkdir(path.join(root, "scripts"), { recursive: true });
	await mkdir(bin);
	await copyFile(
		path.resolve(import.meta.dir, "../../scripts/setup-server"),
		path.join(root, "scripts/setup-server"),
	);
	const log = path.join(directory, "commands.jsonl");
	const checkout = path.join(directory, "checkout");
	await mkdir(checkout);
	for (const command of ["docker", "git", "ssh", "ssh-keygen", "bun"]) {
		const file = path.join(bin, command);
		await writeFile(
			file,
			`#!${process.execPath}\nimport {appendFileSync,writeFileSync} from 'node:fs'; import path from 'node:path';\nconst args = process.argv.slice(2); appendFileSync(process.env.SETUP_LOG, JSON.stringify({command: ${JSON.stringify(command)}, args}) + '\\n'); if (process.env.SETUP_FAIL && args.includes(process.env.SETUP_FAIL)) process.exit(1); const probe = args.find(arg => arg.includes("ownership probe"))?.match(/\\.publication-owner-check-[a-f0-9-]+/)?.[0]; if(probe) writeFileSync(path.join(process.env.ARCHIVE_CHECKOUT_PATH, probe), "probe");\n`,
		);
		await chmod(file, 0o755);
	}
	const key = path.join(directory, "key");
	const hosts = path.join(directory, "known_hosts");
	await writeFile(key, "test fixture only", { mode: 0o600 });
	await writeFile(hosts, "verified fixture host");
	const settings = {
		PORT: "43827",
		POSTGRES_PORT: "5432",
		POSTGRES_DB: "archive",
		POSTGRES_USER: "archive",
		POSTGRES_PASSWORD: "test-fixture-password",
		BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
		BETTER_AUTH_URL: "https://archive.example.test",
		ARCHIVE_PUBLISH_BRANCH: "main",
		ARCHIVE_PUBLISH_ENABLED: "true",
		ARCHIVE_CHECKOUT_PATH: checkout,
		ARCHIVE_RUNTIME_UID: String(process.getuid?.() ?? 1000),
		ARCHIVE_RUNTIME_GID: String(process.getgid?.() ?? 1000),
		ARCHIVE_GIT_NAME: "Archive Publisher",
		ARCHIVE_GIT_EMAIL: "publisher@example.test",
		ARCHIVE_DEPLOY_KEY_PATH: key,
		ARCHIVE_KNOWN_HOSTS_PATH: hosts,
	};
	const writeEnv = (values = settings) =>
		writeFile(
			path.join(root, ".env"),
			Object.entries(values)
				.map(([name, value]) => `${name}=${value}`)
				.join("\n"),
		);
	await writeEnv();
	const run = async (args: string[] = [], fail?: string, unattended = true) => {
		const env = Object.fromEntries(
			Object.entries(process.env).filter(
				([name]) =>
					!name.startsWith("ARCHIVE_") &&
					!name.startsWith("BETTER_AUTH_") &&
					!name.startsWith("POSTGRES_") &&
					name !== "PORT",
			),
		);
		const result = Bun.spawn(
			[
				process.execPath,
				path.join(root, "scripts/setup-server"),
				...(unattended ? ["--yes"] : []),
				...args,
			],
			{
				cwd: directory,
				env: {
					...env,
					PATH: `${bin}:${process.env.PATH}`,
					SETUP_LOG: log,
					...(fail ? { SETUP_FAIL: fail } : {}),
				},
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const stdout = await new Response(result.stdout).text();
		const stderr = await new Response(result.stderr).text();
		const code = await result.exited;
		const commands: { command: string; args: string[] }[] = await readFile(
			log,
			"utf8",
		)
			.then((text) =>
				text
					.trim()
					.split("\n")
					.map((line) => JSON.parse(line)),
			)
			.catch(() => []);
		return { code, stdout, stderr, commands };
	};
	return { root, key, settings, writeEnv, run };
};

test("server setup validates readiness before starting the API and never migrates implicitly", async () => {
	const { run } = await fixture();
	const result = await run();
	expect(result.code, result.stderr).toBe(0);
	expect(result.commands.some((item) => item.args.includes("latest"))).toBe(
		false,
	);
	const readiness = result.commands.findIndex((item) =>
		item.args.some((arg) =>
			arg.includes("await readPublicationStatus(db, config)"),
		),
	);
	const start = result.commands.findIndex(
		(item) =>
			item.args.join(" ") === "compose up -d --wait --wait-timeout 60 api",
	);
	expect(readiness).toBeGreaterThan(0);
	expect(start).toBeGreaterThan(readiness);
	expect(result.stdout).toContain("No publication was started");
});
test("--migrate explicitly applies pending migrations before readiness validation", async () => {
	const { run } = await fixture();
	const result = await run(["--migrate"]);
	expect(result.code, result.stderr).toBe(0);
	const migration = result.commands.findIndex((item) =>
		item.args.includes("latest"),
	);
	const readiness = result.commands.findIndex((item) =>
		item.args.some((arg) =>
			arg.includes("await readPublicationStatus(db, config)"),
		),
	);
	expect(migration).toBeGreaterThan(0);
	expect(readiness).toBeGreaterThan(migration);
});
test("server setup rejects missing .env and insecure example settings before commands run", async () => {
	const { root, run, settings, writeEnv } = await fixture();
	await rm(path.join(root, ".env"));
	expect((await run()).stderr).toContain("Missing .env");
	await writeEnv({
		...settings,
		BETTER_AUTH_SECRET: "local-development-secret-do-not-use-in-production",
	});
	const result = await run();
	expect(result.code).toBe(1);
	expect(result.stderr).toContain("unique BETTER_AUTH_SECRET");
	expect(result.commands).toHaveLength(0);
});
test("server setup rejects unsafe SSH permissions before Docker or Git runs", async () => {
	const { key, run } = await fixture();
	await chmod(key, 0o644);
	const result = await run();
	expect(result.code).toBe(1);
	expect(result.stderr).toContain("0600");
	expect(result.commands).toHaveLength(0);
});
test("server setup stops on migration or readiness failure without starting the API", async () => {
	for (const failure of ["latest", "-e"]) {
		const { run } = await fixture();
		const result = await run(["--migrate"], failure);
		expect(result.code).toBe(1);
		expect(
			result.commands.some(
				(item) =>
					item.args.join(" ") === "compose up -d --wait --wait-timeout 60 api",
			),
		).toBe(false);
	}
});

test("server setup rejects disabled publication, missing SSH files, and local HTTP origins", async () => {
	for (const change of [
		{ ARCHIVE_PUBLISH_ENABLED: "false" },
		{ ARCHIVE_KNOWN_HOSTS_PATH: "/missing-server-setup-hosts" },
		{ BETTER_AUTH_URL: "http://localhost:43827" },
	]) {
		const { settings, writeEnv, run } = await fixture();
		await writeEnv({ ...settings, ...change });
		const result = await run();
		expect(result.code).toBe(1);
		expect(result.commands).toHaveLength(0);
	}
});

test("server setup stops before API startup if SSH remote access fails", async () => {
	const { run } = await fixture();
	const result = await run([], "ls-remote");
	expect(result.code).toBe(1);
	expect(result.stderr).toContain("SSH and remote read access failed");
	expect(
		result.commands.some(
			(item) =>
				item.args.join(" ") === "compose up -d --wait --wait-timeout 60 api",
		),
	).toBe(false);
});

test("server setup requires explicit --yes without a terminal before running commands", async () => {
	const { run } = await fixture();
	const result = await run([], undefined, false);
	expect(result.code).toBe(1);
	expect(result.stderr).toContain("Use --yes for unattended setup");
	expect(result.commands).toHaveLength(0);
});

test("server setup rejects missing or malformed commit identity before starting commands", async () => {
	for (const change of [
		{ ARCHIVE_GIT_NAME: "" },
		{ ARCHIVE_GIT_EMAIL: "" },
		{ ARCHIVE_GIT_NAME: '"Bad\\nName"' },
	]) {
		const { settings, writeEnv, run } = await fixture();
		await writeEnv({ ...settings, ...change });
		const result = await run();
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("ARCHIVE_GIT_");
		expect(result.commands).toHaveLength(0);
	}
});

test("server setup rejects passphrase-protected keys before checkout preparation with actionable guidance", async () => {
	const { run } = await fixture();
	const result = await run([], "-y");
	expect(result.code).toBe(1);
	expect(result.stderr).toContain("dedicated unencrypted publication key");
	expect(result.stderr).toContain(
		"do not remove the passphrase from your everyday development key",
	);
	expect(
		result.commands.some((item) =>
			item.args.includes("scripts/setup-archive-publication"),
		),
	).toBe(false);
	expect(result.commands.some((item) => item.command === "docker")).toBe(false);
});

test("server setup rejects root, invalid IDs, and a private key owned by a different runtime user", async () => {
	for (const change of [
		{ ARCHIVE_RUNTIME_UID: "0" },
		{ ARCHIVE_RUNTIME_GID: "not-a-gid" },
		{ ARCHIVE_RUNTIME_UID: "99999" },
	]) {
		const { settings, writeEnv, run } = await fixture();
		await writeEnv({ ...settings, ...change });
		const result = await run();
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("ARCHIVE_RUNTIME_");
		expect(result.commands).toHaveLength(0);
	}
});

test("server setup rejects mismatched checkout group before starting the API", async () => {
	const { settings, writeEnv, run } = await fixture();
	await writeEnv({
		...settings,
		ARCHIVE_RUNTIME_GID: String(Number(settings.ARCHIVE_RUNTIME_GID) + 1),
	});
	const result = await run();
	expect(result.code).toBe(1);
	expect(result.stderr).toContain("must match the host checkout owner");
	expect(
		result.commands.some(
			(item) =>
				item.args.join(" ") === "compose up -d --wait --wait-timeout 60 api",
		),
	).toBe(false);
});

test("server setup stops with ownership guidance when the non-root container cannot write", async () => {
	const { run } = await fixture();
	const result = await run([], "-e");
	expect(result.code).toBe(1);
	expect(result.stderr).toContain(
		"container cannot write as the host checkout owner",
	);
	expect(
		result.commands.some(
			(item) =>
				item.args.join(" ") === "compose up -d --wait --wait-timeout 60 api",
		),
	).toBe(false);
});
