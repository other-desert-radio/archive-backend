import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
	LabeledFormControl,
	OnboardingModal,
	SearchableMultiSelect,
	TagsInput,
	type TagsInputValue,
} from "../../src/admin-ui/components/shared/modal/index.js";
import "../../src/admin-ui/styles.css";

const Fixture = () => {
	const [open, setOpen] = useState(false);
	const [item, setItem] = useState(1);
	const [title, setTitle] = useState("");
	const [tags, setTags] = useState<TagsInputValue>({ tags: [], draft: "" });
	const [djs, setDJs] = useState<number[]>([]);
	const [submissions, setSubmissions] = useState(0);
	const [fail, setFail] = useState(false);
	const [hold, setHold] = useState(false);
	const [release, setRelease] = useState<(() => void) | undefined>();
	const advance = () => {
		setItem((current) => current + 1);
		setTitle("");
		setTags({ tags: [], draft: "" });
		setDJs([]);
	};
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				Open fixture
			</button>
			<label>
				<input
					type="checkbox"
					checked={fail}
					onChange={(event) => setFail(event.target.checked)}
				/>
				Fail save
			</label>
			<label>
				<input
					type="checkbox"
					checked={hold}
					onChange={(event) => setHold(event.target.checked)}
				/>
				Hold save
			</label>
			<output aria-label="Submission count">{submissions}</output>
			<button type="button" onClick={() => release?.()}>
				Release save
			</button>
			<OnboardingModal
				isOpen={open}
				title={`Import fixture ${item}`}
				onClose={() => setOpen(false)}
				hasUnsavedChanges={
					title !== "" ||
					tags.draft !== "" ||
					tags.tags.length > 0 ||
					djs.length > 0
				}
				headerContent={<span>29 remaining</span>}
				secondaryAction={{ label: "Skip", onClick: advance }}
				navigationAction={{ label: "Next Show", onClick: advance }}
				onSubmitted={advance}
				submitLabel="Save"
				cancelLabel="Cancel"
				onSubmit={async () => {
					setSubmissions((current) => current + 1);
					if (hold)
						await new Promise<void>((resolve) => setRelease(() => resolve));
					if (fail) throw new Error("Fixture save failed");
				}}
			>
				<LabeledFormControl
					id="fixture-title"
					name="title"
					label="title"
					value={title}
					onChange={setTitle}
				/>
				<SearchableMultiSelect
					key={`djs-${item}`}
					id="fixture-djs"
					label="DJs"
					options={[{ id: 1, label: "Known DJ", searchText: "Known DJ" }]}
					selectedIds={djs}
					onChange={setDJs}
					helper="Unmatched DJs: Unrecognized source name"
				/>
				<TagsInput
					key={`tags-${item}`}
					id="fixture-tags"
					value={tags}
					onChange={setTags}
					options={[{ id: 1, title: "Ambient", color: "#cccccc" }]}
					helper={`Unresolved keys: /genres/${"long-source-key-".repeat(8)}/`}
				/>
			</OnboardingModal>
		</>
	);
};
const root = document.getElementById("root");
if (root) createRoot(root).render(<Fixture />);
