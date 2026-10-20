import { expect, test } from "bun:test";
import { readPublicationConfig } from "../../src/publication/index.js";

const root = "/work/archive-backend";

test("publication defaults are disabled with a dedicated sibling checkout", () => {
	expect(readPublicationConfig({}, root)).toEqual({
		enabled: false,
		repository: "git@github.com:other-desert-radio/archive-site.git",
		checkoutPath: "/work/clean-archive-site",
		branch: "publish-dev",
	});
});

test("normalizes settings and resolves relative paths from the explicit backend root", () => {
	expect(
		readPublicationConfig(
			{
				ARCHIVE_PUBLISH_ENABLED: " true ",
				ARCHIVE_SITE_REPOSITORY: " https://github.com/example/archive.git ",
				ARCHIVE_CHECKOUT_PATH: " ../dedicated/archive ",
				ARCHIVE_PUBLISH_BRANCH: " release/archive-v1.2 ",
			},
			root,
		),
	).toEqual({
		enabled: true,
		repository: "https://github.com/example/archive.git",
		checkoutPath: "/work/dedicated/archive",
		branch: "release/archive-v1.2",
	});
});

test("application uses only ARCHIVE_CHECKOUT_PATH, including inside containers", () => {
	expect(
		readPublicationConfig(
			{
				ARCHIVE_CHECKOUT_PATH: "/archive-site",
				ARCHIVE_CONTAINER_CHECKOUT_PATH: "/ignored",
			},
			root,
		).checkoutPath,
	).toBe("/archive-site");
	expect(
		readPublicationConfig({ ARCHIVE_CONTAINER_CHECKOUT_PATH: "/ignored" }, root)
			.checkoutPath,
	).toBe("/work/clean-archive-site");
});

test("rejects blank or control-character settings even when publishing is disabled", () => {
	for (const name of [
		"ARCHIVE_SITE_REPOSITORY",
		"ARCHIVE_CHECKOUT_PATH",
		"ARCHIVE_PUBLISH_BRANCH",
		"ARCHIVE_PUBLISH_ENABLED",
	]) {
		for (const value of ["", "  ", "bad\u0000value", "bad\nvalue"]) {
			expect(() => readPublicationConfig({ [name]: value }, root)).toThrow(
				name,
			);
		}
	}
});

test("requires explicit boolean strings", () => {
	for (const value of ["1", "yes", "FALSE", "enabled"])
		expect(() =>
			readPublicationConfig({ ARCHIVE_PUBLISH_ENABLED: value }, root),
		).toThrow("ARCHIVE_PUBLISH_ENABLED");
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
			readPublicationConfig({ ARCHIVE_PUBLISH_BRANCH: branch }, root),
		).toThrow("ARCHIVE_PUBLISH_BRANCH");
	}
});

test("accepts SSH remotes and rejects unsupported or credential-bearing URLs", () => {
	for (const repository of [
		"git@github.com:example/archive.git",
		"ssh://git@example.test:2222/archive.git",
	])
		expect(
			readPublicationConfig({ ARCHIVE_SITE_REPOSITORY: repository }, root)
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
			readPublicationConfig({ ARCHIVE_SITE_REPOSITORY: repository }, root),
		).toThrow("ARCHIVE_SITE_REPOSITORY");
	}
});

test("requires an absolute root and a lexically separate checkout", () => {
	expect(() => readPublicationConfig({}, "relative/root")).toThrow(
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
			readPublicationConfig({ ARCHIVE_CHECKOUT_PATH: checkoutPath }, root),
		).toThrow("ARCHIVE_CHECKOUT_PATH");
	expect(
		readPublicationConfig(
			{ ARCHIVE_CHECKOUT_PATH: "/work/archive-backend-copy" },
			root,
		).checkoutPath,
	).toBe("/work/archive-backend-copy");
});

test("publication reads explicit commit identity and rejects incomplete or malformed identity", () => {
	expect(
		readPublicationConfig(
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
		expect(() => readPublicationConfig(environment, root)).toThrow(
			"ARCHIVE_GIT_",
		);
});
