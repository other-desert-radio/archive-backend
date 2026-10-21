import { expect, test } from "bun:test";
import { readPublicationConfig } from "../../src/publication/index.js";

const root = "/work/archive-backend";
const readRemoteConfig = (
	environment: NodeJS.ProcessEnv,
	repositoryRoot: string,
) => {
	const config = readPublicationConfig(
		{
			ARCHIVE_PUBLISH_MODE: "remote",
			ARCHIVE_CHECKOUT_PATH: "../archive-site",
			...environment,
		},
		repositoryRoot,
	);
	if (config.mode !== "remote") throw new Error("Expected remote config");
	return config;
};

test("mode defaults to local and uses the explicit checkout path", () => {
	expect(
		readPublicationConfig({ ARCHIVE_CHECKOUT_PATH: "../archive-site" }, root),
	).toEqual({
		mode: "local",
		checkoutPath: "/work/archive-site",
	});
});

test("publication requires an explicit checkout in both modes", () => {
	for (const mode of ["local", "remote"])
		expect(() =>
			readPublicationConfig({ ARCHIVE_PUBLISH_MODE: mode }, root),
		).toThrow("ARCHIVE_CHECKOUT_PATH");
});

test("local mode reuses the existing checkout setting and ignores Git settings", () => {
	expect(
		readPublicationConfig(
			{
				ARCHIVE_PUBLISH_MODE: " local ",
				ARCHIVE_CHECKOUT_PATH: " ../existing-site ",
				ARCHIVE_SITE_REPOSITORY: "invalid",
				ARCHIVE_PUBLISH_BRANCH: "invalid..branch",
				ARCHIVE_GIT_NAME: "",
				ARCHIVE_PUBLISH_ENABLED: "invalid",
			},
			root,
		),
	).toEqual({ mode: "local", checkoutPath: "/work/existing-site" });
});

test("mode configuration rejects invalid modes without exposing their values", () => {
	for (const mode of ["", " ", "disabled", "LOCAL", "true", "bad\nvalue"]) {
		expect(() =>
			readPublicationConfig({ ARCHIVE_PUBLISH_MODE: mode }, root),
		).toThrow("ARCHIVE_PUBLISH_MODE");
	}
});

test("both publication modes require a valid, separate destination", () => {
	for (const mode of ["local", "remote"]) {
		expect(() =>
			readPublicationConfig({ ARCHIVE_PUBLISH_MODE: mode }, "relative"),
		).toThrow("root must be absolute");
		for (const checkoutPath of [
			"",
			"bad\nvalue",
			".",
			"./generated",
			"..",
			"/",
		]) {
			expect(() =>
				readPublicationConfig(
					{ ARCHIVE_PUBLISH_MODE: mode, ARCHIVE_CHECKOUT_PATH: checkoutPath },
					root,
				),
			).toThrow("ARCHIVE_CHECKOUT_PATH");
		}
	}
});

test("remote mode normalizes Git settings independently of the legacy enable flag", () => {
	expect(
		readPublicationConfig(
			{
				ARCHIVE_PUBLISH_MODE: " remote ",
				ARCHIVE_PUBLISH_ENABLED: "invalid",
				ARCHIVE_CHECKOUT_PATH: "/archive-site",
				ARCHIVE_SITE_REPOSITORY: " https://github.com/example/archive.git ",
				ARCHIVE_PUBLISH_BRANCH: " main ",
				ARCHIVE_GIT_NAME: " Publisher ",
				ARCHIVE_GIT_EMAIL: " publisher@example.test ",
			},
			root,
		),
	).toEqual({
		mode: "remote",
		checkoutPath: "/archive-site",
		repository: "https://github.com/example/archive.git",
		branch: "main",
		gitIdentity: { name: "Publisher", email: "publisher@example.test" },
	});
	for (const [name, value] of [
		["ARCHIVE_SITE_REPOSITORY", "file:///archive"],
		["ARCHIVE_PUBLISH_BRANCH", "a..b"],
		["ARCHIVE_GIT_NAME", "Publisher"],
	]) {
		expect(() =>
			readPublicationConfig(
				{
					ARCHIVE_PUBLISH_MODE: "remote",
					ARCHIVE_CHECKOUT_PATH: "../archive-site",
					[name]: value,
				},
				root,
			),
		).toThrow(name === "ARCHIVE_GIT_NAME" ? "ARCHIVE_GIT_EMAIL" : name);
	}
});

test("remote publication defaults use a dedicated sibling checkout", () => {
	expect(readRemoteConfig({}, root)).toEqual({
		mode: "remote",
		repository: "git@github.com:other-desert-radio/archive-site.git",
		checkoutPath: "/work/archive-site",
		branch: "publish-dev",
	});
});

test("normalizes settings and resolves relative paths from the explicit backend root", () => {
	expect(
		readRemoteConfig(
			{
				ARCHIVE_PUBLISH_MODE: " remote ",
				ARCHIVE_SITE_REPOSITORY: " https://github.com/example/archive.git ",
				ARCHIVE_CHECKOUT_PATH: " ../dedicated/archive ",
				ARCHIVE_PUBLISH_BRANCH: " release/archive-v1.2 ",
			},
			root,
		),
	).toEqual({
		mode: "remote",
		repository: "https://github.com/example/archive.git",
		checkoutPath: "/work/dedicated/archive",
		branch: "release/archive-v1.2",
	});
});

test("application uses only ARCHIVE_CHECKOUT_PATH, including inside containers", () => {
	expect(
		readRemoteConfig(
			{
				ARCHIVE_CHECKOUT_PATH: "/archive-site",
				ARCHIVE_CONTAINER_CHECKOUT_PATH: "/ignored",
			},
			root,
		).checkoutPath,
	).toBe("/archive-site");
	expect(
		readRemoteConfig({ ARCHIVE_CONTAINER_CHECKOUT_PATH: "/ignored" }, root)
			.checkoutPath,
	).toBe("/work/archive-site");
});

test("rejects blank or control-character settings for remote publication", () => {
	for (const name of [
		"ARCHIVE_SITE_REPOSITORY",
		"ARCHIVE_CHECKOUT_PATH",
		"ARCHIVE_PUBLISH_BRANCH",
		"ARCHIVE_PUBLISH_MODE",
	]) {
		for (const value of ["", "  ", "bad\u0000value", "bad\nvalue"]) {
			expect(() => readRemoteConfig({ [name]: value }, root)).toThrow(name);
		}
	}
});

test("rejects unsafe branch names", () => {
	for (const branch of [
		"HEAD",
		"-main",
		"a..b",
		"a@{1}",
		"a b",
		"a\\b",
		"a~b",
		"a:b",
		"/main",
		"main/",
		"a//b",
		"a/.hidden",
		"a.lock",
		"a.lock/b",
		"a.",
	]) {
		expect(() =>
			readRemoteConfig({ ARCHIVE_PUBLISH_BRANCH: branch }, root),
		).toThrow("ARCHIVE_PUBLISH_BRANCH");
	}
});

test("accepts SSH remotes and rejects unsupported or credential-bearing URLs", () => {
	for (const repository of [
		"git@github.com:example/archive.git",
		"ssh://git@example.test:2222/archive.git",
	])
		expect(
			readRemoteConfig({ ARCHIVE_SITE_REPOSITORY: repository }, root)
				.repository,
		).toBe(repository);
	for (const repository of [
		"--upload-pack=bad",
		"../archive",
		"file:///archive",
		"http://example.test/archive",
		"https://user:secret@example.test/archive",
		"https://user@example.test/archive",
		"ssh://git:secret@example.test/archive",
		"https://example.test/",
		"https://example.test/archive?token=secret",
		"https://example.test/archive#main",
	]) {
		expect(() =>
			readRemoteConfig({ ARCHIVE_SITE_REPOSITORY: repository }, root),
		).toThrow("ARCHIVE_SITE_REPOSITORY");
	}
});

test("requires an absolute root and a lexically separate checkout", () => {
	expect(() => readRemoteConfig({}, "relative/root")).toThrow(
		"root must be absolute",
	);
	for (const checkoutPath of [
		".",
		"./generated",
		"..",
		"/",
		"/work/archive-backend/../archive-backend",
	])
		expect(() =>
			readRemoteConfig({ ARCHIVE_CHECKOUT_PATH: checkoutPath }, root),
		).toThrow("ARCHIVE_CHECKOUT_PATH");
	expect(
		readRemoteConfig(
			{ ARCHIVE_CHECKOUT_PATH: "/work/archive-backend-copy" },
			root,
		).checkoutPath,
	).toBe("/work/archive-backend-copy");
});

test("publication reads explicit commit identity and rejects incomplete or malformed identity", () => {
	expect(
		readRemoteConfig(
			{
				ARCHIVE_GIT_NAME: " Archive Publisher ",
				ARCHIVE_GIT_EMAIL: " publisher@example.test ",
			},
			root,
		).gitIdentity,
	).toEqual({ name: "Archive Publisher", email: "publisher@example.test" });
	for (const environment of [
		{ ARCHIVE_GIT_NAME: "Publisher" },
		{ ARCHIVE_GIT_EMAIL: "publisher@example.test" },
		{ ARCHIVE_GIT_NAME: "Publisher", ARCHIVE_GIT_EMAIL: " " },
		{
			ARCHIVE_GIT_NAME: "Publisher\nInjected",
			ARCHIVE_GIT_EMAIL: "publisher@example.test",
		},
	])
		expect(() => readRemoteConfig(environment, root)).toThrow("ARCHIVE_GIT_");
});
