import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
	OnboardingModal,
	SearchableMultiSelect,
	TagsInput,
} from "../../src/admin-ui/components/shared/modal/index.js";

const defaults = {
	isOpen: true,
	title: "Form",
	onClose: () => undefined,
	onSubmit: async () => undefined,
	cancelLabel: "Cancel",
};
test("ordinary forms retain Submit, Cancel, Close, and no navigation", () => {
	const markup = renderToStaticMarkup(
		<OnboardingModal {...defaults}>
			<input aria-label="title" />
		</OnboardingModal>,
	);
	expect(markup).toContain('role="dialog"');
	expect(markup).toContain('aria-label="Close"');
	expect(markup).toContain(">Cancel</button>");
	expect(markup).toContain(">Submit</button>");
	expect(markup).not.toContain('aria-label="Next Show"');
});
test("header content and guarded optional actions render inside the dialog", () => {
	const markup = renderToStaticMarkup(
		<OnboardingModal
			{...defaults}
			headerContent={<span>29 remaining</span>}
			secondaryAction={{
				label: "Skip",
				onClick: () => undefined,
				disabled: true,
			}}
			navigationAction={{
				label: "Next Show",
				onClick: () => undefined,
				disabled: true,
			}}
		>
			<input aria-label="title" />
		</OnboardingModal>,
	);
	expect(markup).toContain("29 remaining");
	expect(markup).toContain(
		'aria-label="Next Show" data-modal-dismiss="true" disabled=""',
	);
	expect(markup).toMatch(/disabled="">Skip<\/button>/);
	expect(markup).not.toContain(">Cancel</button>");
});
test("DJ and tag helpers describe their controls while preserving built-in tag guidance", () => {
	const markup = renderToStaticMarkup(
		<>
			<SearchableMultiSelect
				id="djs"
				label="DJs"
				options={[{ id: 1, label: "DJ", searchText: "DJ" }]}
				selectedIds={[]}
				onChange={() => undefined}
				helper="Unmatched DJs"
			/>
			<TagsInput
				id="tags"
				value={{ tags: [], draft: "" }}
				options={[]}
				onChange={() => undefined}
				helper="Unresolved keys"
			/>
		</>,
	);
	expect(markup).toContain('aria-describedby="djs-search-help djs-help"');
	expect(markup).toContain('id="djs-help"');
	expect(markup).toContain('aria-describedby="tags-help tags-extra-help"');
	expect(markup).toContain('id="tags-extra-help"');
	expect(markup).toContain("Type to search.");
});
