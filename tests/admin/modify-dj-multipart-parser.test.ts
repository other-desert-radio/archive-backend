import { describe, expect, test } from "bun:test";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { parseModifyDJMultipart } from "../../src/admin/routes/djs/index.js";

const submitForm = async (form: FormData) => {
	const request = new Request("http://localhost/", {
		method: "POST",
		body: form,
	});
	const contentType = request.headers.get("content-type") ?? "";
	const body = Buffer.from(await request.arrayBuffer());
	const app = Fastify({ logger: false });
	await app.register(multipart, {
		limits: { fileSize: Infinity, files: 1, fields: 8, parts: 9 },
	});
	app.post("/", async (routeRequest) => parseModifyDJMultipart(routeRequest));
	const response = await app.inject({
		method: "POST",
		url: "/",
		headers: { "content-type": contentType },
		payload: body,
	});
	await app.close();
	return response;
};

const completeForm = () => {
	const form = new FormData();
	form.append("id", "42");
	form.append("title", "DJ Updated");
	form.append("bio", "Updated bio");
	form.append("tags", "dance, house");
	form.append("socials", "@dj-updated");
	form.append("showTitle", "Late Night");
	form.append("showDescription", "An updated broadcast.");
	form.append("removeImage", "false");
	return form;
};

describe("parseModifyDJMultipart", () => {
	test("parses a complete replacement payload and optional image", async () => {
		const form = completeForm();
		form.append(
			"image",
			new File(["image bytes"], "dj.webp", { type: "image/webp" }),
		);

		const response = await submitForm(form);

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			valid: true,
			form: {
				id: 42,
				title: "DJ Updated",
				bio: "Updated bio",
				tags: ["dance", "house"],
				socials: "@dj-updated",
				showTitle: "Late Night",
				showDescription: "An updated broadcast.",
				removeImage: false,
				image: {
					bytes: {
						type: "Buffer",
						data: [105, 109, 97, 103, 101, 32, 98, 121, 116, 101, 115],
					},
					filename: "dj.webp",
					contentType: "image/webp",
				},
			},
		});
	});

	test("preserves explicit empty values for full replacement", async () => {
		const form = completeForm();
		form.set("tags", "");
		form.set("socials", " ");
		form.set("showTitle", "");
		form.set("showDescription", "\n");
		form.set("removeImage", "true");

		const response = await submitForm(form);

		expect(response.json()).toEqual({
			valid: true,
			form: {
				id: 42,
				title: "DJ Updated",
				bio: "Updated bio",
				tags: [],
				removeImage: true,
			},
		});
	});

	test("rejects non-multipart and invalid removeImage requests", async () => {
		const app = Fastify({ logger: false });
		await app.register(multipart);
		app.post("/", async (request) => parseModifyDJMultipart(request));
		const nonMultipart = await app.inject({ method: "POST", url: "/" });
		expect(nonMultipart.json()).toEqual({
			valid: false,
			error: "Request must use multipart/form-data",
		});
		await app.close();

		const form = completeForm();
		form.set("removeImage", "yes");
		expect((await submitForm(form)).json()).toEqual({
			valid: false,
			error: "removeImage must be true or false",
		});
	});

	test("rejects unexpected and duplicate fields", async () => {
		const unexpected = completeForm();
		unexpected.delete("showDescription");
		unexpected.append("unknown", "value");
		expect((await submitForm(unexpected)).json()).toEqual({
			valid: false,
			error: "Unexpected multipart field: unknown",
		});

		const duplicate = completeForm();
		duplicate.delete("showDescription");
		duplicate.append("title", "DJ Again");
		expect((await submitForm(duplicate)).json()).toEqual({
			valid: false,
			error: "Multipart field was submitted more than once: title",
		});
	});
});
