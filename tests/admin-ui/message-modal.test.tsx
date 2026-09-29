import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageModal } from "../../src/admin-ui/components/shared/modal/index.js";

test("message modal renders supplied text and primary, secondary, and additional actions", () => {
	const markup = renderToStaticMarkup(
		<MessageModal
			title="Publish archive?"
			message="Choose how to continue."
			primaryAction={{
				label: "Publish",
				onClick: () => undefined,
				disabled: true,
			}}
			secondaryAction={{ label: "Go back", onClick: () => undefined }}
			additionalActions={[{ label: "Preview", onClick: () => undefined }]}
			onDismiss={() => undefined}
		/>,
	);
	expect(markup).toContain("Publish archive?");
	expect(markup).toContain("Choose how to continue.");
	expect(markup).toContain('role="dialog"');
	expect(markup).toContain('data-action="primary" disabled=""');
	expect(markup).toContain("Go back");
	expect(markup).toContain("Preview");
});

test("message modal supports a single action and alert dialog semantics", () => {
	const markup = renderToStaticMarkup(
		<MessageModal
			title="Done"
			message="Archive updated."
			primaryAction={{ label: "OK", onClick: () => undefined }}
			onDismiss={() => undefined}
			role="alertdialog"
		/>,
	);
	expect(markup).toContain('role="alertdialog"');
	expect(markup).not.toContain('data-action="secondary"');
	expect(markup).toContain("OK");
});
