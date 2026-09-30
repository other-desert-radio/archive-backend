import { expect, test } from "bun:test";
import {
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("database backup scripts preserve files and handle failures safely", () => {
	const directory = mkdtempSync(join(tmpdir(), "archive-backup-test-"));
	try {
		writeFileSync(
			join(directory, "docker"),
			'#!/bin/sh\nprintf "%s\\n" "$@" > "$CALL_LOG"\nif [ "$FAIL_DOCKER" = 1 ]; then printf partial; exit 1; fi\ncase "$*" in *pg_dump*) printf archive;; *pg_restore*) cat > "$RESTORE_LOG";; esac\n',
			{ mode: 0o700 },
		);
		const run = (script: string, args: string[], fail = false) =>
			Bun.spawnSync(["bash", resolve("scripts", script), ...args], {
				cwd: directory,
				env: {
					...process.env,
					PATH: `${directory}:${process.env.PATH}`,
					CALL_LOG: join(directory, "calls"),
					RESTORE_LOG: join(directory, "restored"),
					FAIL_DOCKER: fail ? "1" : "0",
				},
			});
		expect(run("pg-dump", ["backup.dump"]).exitCode).toBe(0);
		expect(readFileSync(join(directory, "backup.dump"), "utf8")).toBe(
			"archive",
		);
		expect(run("pg-dump", ["backup.dump"]).exitCode).not.toBe(0);
		expect(readFileSync(join(directory, "backup.dump"), "utf8")).toBe(
			"archive",
		);
		expect(run("pg-dump", ["failed.dump"], true).exitCode).not.toBe(0);
		expect(
			readdirSync(directory).some((name) => name.startsWith("failed.dump")),
		).toBe(false);
		expect(run("pg-import", ["backup.dump"]).exitCode).not.toBe(0);
		expect(run("pg-import", ["missing.dump", "--confirm"]).exitCode).not.toBe(
			0,
		);
		expect(run("pg-import", ["backup.dump", "--confirm"]).exitCode).toBe(0);
		expect(readFileSync(join(directory, "restored"), "utf8")).toBe("archive");
		expect(readFileSync(join(directory, "calls"), "utf8")).toContain(
			"--single-transaction --exit-on-error",
		);
		expect(
			run("pg-import", ["backup.dump", "--confirm"], true).exitCode,
		).not.toBe(0);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
