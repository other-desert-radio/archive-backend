import { expect, test } from "bun:test";
import { mixcloudCloudcasts } from "../../src/db/import-mixcloud.js";
import { parseMixcloudEntry } from "../../src/utils/index.js";

test("diagnostic import uses shared suggestions and reports failures and missing dates", () => {
	const result = Bun.spawnSync(
		[process.execPath, "src/db/import-mixcloud.ts"],
		{
			env: {
				...process.env,
				DATABASE_URL: "postgres://invalid:invalid@localhost:1/invalid",
			},
		},
	);
	const stdout = result.stdout.toString();
	const stderr = result.stderr.toString();
	const suggestions = mixcloudCloudcasts.data
		.map(parseMixcloudEntry)
		.filter((entry) => entry !== undefined);

	expect(result.exitCode).toBe(0);
	expect(stdout).toContain(`success count: ${suggestions.length}`);
	expect(stderr).toContain(
		`failure count: ${mixcloudCloudcasts.data.length - suggestions.length}`,
	);
	expect(stderr).toContain(
		`missing derived date count: ${suggestions.filter((entry) => entry.derived_date === null).length}`,
	);
	expect(stderr).toContain(
		"Failed to parse show name: \"K Sera Sarah's Beyond Karaoke Episode 12 - Free Will or Free Won't\"",
	);
	expect(stdout).toContain(
		"parser: common-comma-date-with-flexible-spacing (version 0)",
	);
	expect(stdout).toContain("derived_date: not extracted yet");
	expect(stdout).toContain("date_source: not extracted yet");
	expect(stdout).toContain("dj_names: Caroline, Ethan");
	expect(stdout).toContain("key: /otherdesertradio/");
});
