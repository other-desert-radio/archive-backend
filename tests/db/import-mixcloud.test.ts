import { expect, test } from "bun:test";
import {
	mixcloudCloudcasts,
	validateMixcloudCloudcasts,
} from "../../src/db/import-mixcloud.js";
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
		"parser: common-comma-date-with-flexible-spacing (version 1)",
	);
	expect(stdout).toContain("derived_date: 2020-04-06T00:00:00.000Z");
	expect(stdout).toContain("date_source: title");
	expect(stdout).toContain("date_source: created_time");
	expect(stdout).toContain("dj_names: Caroline, Ethan");
	expect(stdout).toContain("key: /otherdesertradio/");
});

test("validates bundled JSON and rejects invalid source data before parsing", () => {
	expect(mixcloudCloudcasts.data).toHaveLength(402);
	expect(validateMixcloudCloudcasts(mixcloudCloudcasts)).toBe(
		mixcloudCloudcasts,
	);
	for (const value of [
		null,
		{},
		{ data: [{ ...mixcloudCloudcasts.data[0], created_time: "invalid" }] },
		{ data: [{ ...mixcloudCloudcasts.data[0], tags: "invalid" }] },
	]) {
		expect(() => validateMixcloudCloudcasts(value)).toThrow(
			"Invalid Mixcloud JSON",
		);
	}
});
