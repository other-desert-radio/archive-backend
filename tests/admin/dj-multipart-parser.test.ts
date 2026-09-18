import { describe, expect, test } from "bun:test";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { parseCreateDJMultipart } from "../../src/admin/routes/djs/index.js";

const submitForm = async (form: FormData) => {
	const request = new Request("http://localhost/", {
		method: "POST",
		body: form,
	});
	const contentType = request.headers.get("content-type") ?? "";
	const body = Buffer.from(await request.arrayBuffer());
	const app = Fastify({ logger: false });
	await app.register(multipart);
	app.post("/", async (routeRequest) => parseCreateDJMultipart(routeRequest));

	const response = await app.inject({
		method: "POST",
		url: "/",
		headers: {
			"content-type": contentType,
		},
		payload: body,
	});
	await app.close();
	return response;
};

describe("parseCreateDJMultipart", () => {
	test("parses text fields and an optional image file", async () => {
		const form = new FormData();
		form.append("title", "DJ New");
		form.append("bio", "A bio");
		form.append("tags", "dance, house");
		form.append("socials", "@dj-new");
		form.append(
			"image",
			new File(["image bytes"], "dj.png", { type: "image/png" }),
		);

		const response = await submitForm(form);

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			valid: true,
			form: {
				title: "DJ New",
				bio: "A bio",
				tags: "dance, house",
				socials: "@dj-new",
				image: {
					bytes: {
						type: "Buffer",
						data: [105, 109, 97, 103, 101, 32, 98, 121, 116, 101, 115],
					},
					filename: "dj.png",
					contentType: "image/png",
				},
			},
		});
	});

	test("rejects non-multipart requests", async () => {
		const app = Fastify({ logger: false });
		await app.register(multipart);
		app.post("/", async (request) => parseCreateDJMultipart(request));

		const response = await app.inject({
			method: "POST",
			url: "/",
			payload: { title: "DJ New" },
		});

		expect(response.json()).toEqual({
			valid: false,
			error: "Request must use multipart/form-data",
		});
		await app.close();
	});

	test("rejects unexpected and duplicate fields", async () => {
		const form = new FormData();
		form.append("title", "DJ New");
		form.append("unknown", "value");

		const unexpected = await submitForm(form);
		expect(unexpected.json()).toEqual({
			valid: false,
			error: "Unexpected multipart field: unknown",
		});

		const duplicateForm = new FormData();
		duplicateForm.append("title", "DJ New");
		duplicateForm.append("title", "DJ Again");
		const duplicate = await submitForm(duplicateForm);
		expect(duplicate.json()).toEqual({
			valid: false,
			error: "Multipart field was submitted more than once: title",
		});
	});
});
