export type MultipartTestField = string | string[] | File;

export const multipartPayload = async (
	fields: Record<string, MultipartTestField>,
) => {
	const form = new FormData();
	for (const [name, value] of Object.entries(fields)) {
		if (value instanceof File) {
			form.append(name, value);
			continue;
		}
		form.append(name, Array.isArray(value) ? value.join(",") : value);
	}

	const request = new Request("http://localhost/", {
		method: "POST",
		body: form,
	});
	const contentType = request.headers.get("content-type") ?? "";

	return {
		headers: { "content-type": contentType },
		payload: Buffer.from(await request.arrayBuffer()),
	};
};
