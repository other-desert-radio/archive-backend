import { expect, test } from "bun:test";

test("hard-remove-dj rejects invalid arguments before connecting", () => {
	for (const args of [
		[],
		["0"],
		["-1"],
		["1.5"],
		["1e2"],
		["2147483648"],
		["1", "--confirm"],
		["1", "--including-shows", "extra"],
	]) {
		const result = Bun.spawnSync(["bash", "scripts/hard-remove-dj", ...args], {
			env: {
				...process.env,
				DATABASE_URL: "postgres://invalid:invalid@localhost:1/invalid",
			},
		});
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toBe(
			"Usage: ./scripts/hard-remove-dj <id> [--including-shows]\n",
		);
		expect(result.stdout.toString()).toBe("");
	}
});

const databaseUrl = process.env.HARD_REMOVE_DJ_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"hard removal previews, cancels, preserves or deletes shared shows",
	async () => {
		const { Client } = await import("pg");
		const client = new Client({ connectionString: databaseUrl });
		await client.connect();
		const schema = `removal_${crypto.randomUUID().replaceAll("-", "")}`;
		if (!databaseUrl) throw new Error("Test database URL is required");
		const url = new URL(databaseUrl);
		url.searchParams.set("options", `-c search_path=${schema}`);
		try {
			await client.query(`CREATE SCHEMA ${schema}`);
			await client.query(`SET search_path TO ${schema}`);
			await client.query(`
			CREATE TABLE djs (id integer PRIMARY KEY, title text NOT NULL);
			CREATE TABLE shows (id integer PRIMARY KEY, title text NOT NULL);
			CREATE TABLE show_djs (
				show_id integer REFERENCES shows ON DELETE CASCADE,
				dj_id integer REFERENCES djs ON DELETE CASCADE,
				UNIQUE (show_id, dj_id)
			);
		`);
			for (const [includingShows, answer] of [
				[true, "no"],
				[false, "delete 1"],
				[true, "delete 1"],
			] as const) {
				await client.query(`
				TRUNCATE show_djs, shows, djs;
				INSERT INTO djs VALUES (1, 'Target'), (2, 'Other');
				INSERT INTO shows VALUES (10, 'Solo'), (20, 'Shared'), (30, 'Unrelated');
				INSERT INTO show_djs VALUES (10, 1), (20, 1), (20, 2), (30, 2);
			`);
				const child = Bun.spawn(
					[
						"bash",
						"scripts/hard-remove-dj",
						"1",
						...(includingShows ? ["--including-shows"] : []),
					],
					{
						env: { ...process.env, DATABASE_URL: url.toString() },
						stdin: "pipe",
						stdout: "pipe",
						stderr: "pipe",
					},
				);
				// Wait for the question: readline does not retain answers sent before it opens.
				let output = "";
				for await (const chunk of child.stdout) {
					output += new TextDecoder().decode(chunk);
					if (output.includes("to confirm: ")) {
						child.stdin.write(`${answer}\n`);
						child.stdin.end();
					}
				}
				expect(await child.exited).toBe(0);
				expect(await new Response(child.stderr).text()).toBe("");
				if (includingShows) {
					expect(output).toContain('10: "Solo"');
					expect(output).toContain('20: "Shared"');
					expect(output).not.toContain('30: "Unrelated"');
				}
				const cancelled = answer === "no";
				expect(
					(await client.query("SELECT id FROM djs ORDER BY id")).rows,
				).toEqual(cancelled ? [{ id: 1 }, { id: 2 }] : [{ id: 2 }]);
				expect(
					(await client.query("SELECT id FROM shows ORDER BY id")).rows,
				).toEqual(
					!cancelled && includingShows
						? [{ id: 30 }]
						: [{ id: 10 }, { id: 20 }, { id: 30 }],
				);
			}
		} finally {
			await client.query(`DROP SCHEMA ${schema} CASCADE`);
			await client.end();
		}
	},
	15000,
);
