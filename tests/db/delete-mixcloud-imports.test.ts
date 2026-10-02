import { expect, test } from "bun:test";

test("Mixcloud deletion refuses without confirmation before connecting", () => {
	const result = Bun.spawnSync(["bash", "scripts/delete-mixcloud-imports"], {
		env: {
			...process.env,
			DATABASE_URL: "postgres://invalid:invalid@localhost:1/invalid",
		},
	});
	expect(result.exitCode).toBe(1);
	expect(result.stderr.toString()).toContain(
		"Refusing to delete Mixcloud imports without --confirm.",
	);
	expect(result.stderr.toString()).toContain(
		"Usage: bun src/db/delete-mixcloud-imports.ts --confirm",
	);
	expect(result.stdout.toString()).toBe("");
});
