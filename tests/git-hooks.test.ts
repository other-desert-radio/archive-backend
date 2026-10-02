import { expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("pre-commit stages formatting without adding unrelated or partial changes", () => {
	const directory = mkdtempSync(join(tmpdir(), "archive-hook-test-"));
	const hook = resolve(".githooks/pre-commit");
	const run = (...args: string[]) =>
		Bun.spawnSync(args, {
			cwd: directory,
			env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
		});
	const git = (...args: string[]) => {
		const result = run("git", ...args);
		expect(result.exitCode).toBe(0);
		return result.stdout.toString();
	};
	try {
		git("init", "--quiet");
		mkdirSync(join(directory, "node_modules/.bin"), { recursive: true });
		for (const name of ["biome", "prettier"]) {
			writeFileSync(
				join(directory, "node_modules/.bin", name),
				'#!/bin/bash\nfor file in "$@"; do\ncase "$file" in ./*) printf "formatted\\n" >> "$file";; esac\ndone\n',
				{ mode: 0o700 },
			);
		}
		writeFileSync(join(directory, "bun"), "#!/bin/sh\nexit 0\n", {
			mode: 0o700,
		});
		writeFileSync(join(directory, "source with spaces.ts"), "source\n");
		writeFileSync(join(directory, "notes.md"), "notes\n");
		writeFileSync(join(directory, "unrelated.ts"), "untouched\n");
		git("add", "--", "source with spaces.ts", "notes.md");
		expect(run("bash", hook).exitCode).toBe(0);
		expect(git("show", ":source with spaces.ts")).toBe("source\nformatted\n");
		expect(git("show", ":notes.md")).toBe("notes\nformatted\n");
		expect(git("diff", "--name-only")).toBe("");
		expect(readFileSync(join(directory, "unrelated.ts"), "utf8")).toBe(
			"untouched\n",
		);
		expect(git("diff", "--cached", "--name-only")).not.toContain(
			"unrelated.ts",
		);
		writeFileSync(join(directory, "notes.md"), "unstaged work\n");
		const rejected = run("bash", hook);
		expect(rejected.exitCode).not.toBe(0);
		expect(rejected.stderr.toString()).toContain("partially staged");
		expect(git("show", ":notes.md")).toBe("notes\nformatted\n");
		expect(readFileSync(join(directory, "notes.md"), "utf8")).toBe(
			"unstaged work\n",
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
