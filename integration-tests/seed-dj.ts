const baseURL = process.env.E2E_BASE_URL ?? "http://api:3000";
const image = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL4YQAAAABJRU5ErkJggg==",
	"base64",
);

for (let attempt = 0; attempt < 30; attempt += 1) {
	try {
		const response = await fetch(`${baseURL}/health`);
		if (response.ok) break;
	} catch {
		// The API container is still starting.
	}
	await new Promise((resolve) => setTimeout(resolve, 500));
	if (attempt === 29) throw new Error("Integration API did not become ready.");
}

const form = new FormData();
form.set("title", "Integration test DJ");
form.set("bio", "A DJ created only for the browser integration test.");
form.set("tags", "");
form.set("socials", "");
form.set("showTitle", "");
form.set("showDescription", "");
form.set("image", new File([image], "seed.png", { type: "image/png" }));

const response = await fetch(`${baseURL}/api/admin/create-dj`, {
	method: "POST",
	headers: { authorization: "Basic YWRtaW46YWRtaW4=" },
	body: form,
});
if (!response.ok) {
	throw new Error(`Could not seed integration DJ: ${await response.text()}`);
}
