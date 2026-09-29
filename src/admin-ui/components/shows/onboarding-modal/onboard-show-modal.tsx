import { useEffect, useRef, useState } from "react";
import {
	hasFormChanges,
	LabeledFormControl,
	OnboardingModal,
	SearchableMultiSelect,
	type SearchableMultiSelectOption,
	TagsInput,
	type TagsInputValue,
	useTagOptions,
} from "../../shared/modal/index.js";
import {
	buildCreateShowRequest,
	type CreateShowForm,
} from "./onboard-show-utils.js";

type Props = {
	isOpen: boolean;
	djs: { id: number; title: string }[];
	isDJsLoading: boolean;
	djsError?: string;
	onRetryDJs: () => void;
	onClose: () => void;
	onSubmit: (request: CreateShowForm) => Promise<void>;
};
/** Supplies Show-specific values and validation to the shared onboarding modal. */
export const OnboardShowModal = ({
	isOpen,
	djs,
	isDJsLoading,
	djsError,
	onRetryDJs,
	onClose,
	onSubmit,
}: Props) => {
	const initialValues = useRef({
		title: "",
		date: "",
		hours: "",
		minutes: "",
		seconds: "",
		image: "",
		tags: [] as string[],
		tagDraft: "",
		url: "",
		selected: [] as number[],
	});
	const [title, setTitle] = useState("");
	const [date, setDate] = useState("");
	const [hours, setHours] = useState("");
	const [minutes, setMinutes] = useState("");
	const [seconds, setSeconds] = useState("");
	const [image, setImage] = useState("");
	const [tags, setTags] = useState<TagsInputValue>({ tags: [], draft: "" });
	const { tagOptions, isTagsLoading, tagsError, loadTagOptions } =
		useTagOptions(isOpen);
	const [url, setUrl] = useState("");
	const [selected, setSelected] = useState<number[]>([]);
	useEffect(() => {
		if (isOpen) {
			initialValues.current = {
				title: "",
				date: "",
				hours: "",
				minutes: "",
				seconds: "",
				image: "",
				tags: [] as string[],
				tagDraft: "",
				url: "",
				selected: [] as number[],
			};
			setTitle("");
			setDate("");
			setHours("");
			setMinutes("");
			setSeconds("");
			setImage("");
			setTags({ tags: [], draft: "" });
			setUrl("");
			setSelected([]);
			onRetryDJs();
		}
	}, [isOpen, onRetryDJs]);
	const djOptions: SearchableMultiSelectOption[] = djs.map((dj) => ({
		id: dj.id,
		label: `${dj.title} (#${dj.id})`,
		searchText: `${dj.title} ${dj.id}`,
	}));
	const submit = async () => {
		if (isDJsLoading || djsError !== undefined)
			throw new Error("DJs must finish loading before submitting.");
		if (selected.length === 0) throw new Error("Select at least one DJ.");
		await onSubmit(
			buildCreateShowRequest({
				title,
				date,
				hours,
				minutes,
				seconds,
				image,
				tags: [...tags.tags, tags.draft].join(","),
				url,
				djs: selected,
			}),
		);
	};
	return (
		<OnboardingModal
			isOpen={isOpen}
			hasUnsavedChanges={hasFormChanges(
				{
					title,
					date,
					hours,
					minutes,
					seconds,
					image,
					tags: tags.tags,
					tagDraft: tags.draft,
					url,
					selected,
				},
				initialValues.current,
			)}
			title="Onboard Show"
			onClose={onClose}
			onSubmit={submit}
			cancelLabel="Cancel"
		>
			<LabeledFormControl
				id="show-title"
				name="title"
				label="title"
				value={title}
				onChange={setTitle}
				required
			/>
			<LabeledFormControl
				id="show-date"
				name="date"
				label="date"
				type="date"
				value={date}
				onChange={setDate}
				required
			/>
			<LabeledFormControl
				id="show-hours"
				name="hours"
				label="duration (hours)"
				value={hours}
				onChange={setHours}
			/>
			<LabeledFormControl
				id="show-minutes"
				name="minutes"
				label="duration (minutes)"
				value={minutes}
				onChange={setMinutes}
			/>
			<LabeledFormControl
				id="show-seconds"
				name="seconds"
				label="duration (seconds)"
				value={seconds}
				onChange={setSeconds}
			/>
			<LabeledFormControl
				id="show-image"
				name="image"
				label="image URL"
				type="url"
				value={image}
				onChange={setImage}
			/>
			<SearchableMultiSelect
				id="show-djs"
				label="DJs"
				options={djOptions}
				selectedIds={selected}
				onChange={setSelected}
				isLoading={isDJsLoading}
				{...(djsError === undefined ? {} : { error: djsError })}
				onRetry={onRetryDJs}
			/>
			<TagsInput
				id="show-tags"
				value={tags}
				onChange={setTags}
				options={tagOptions}
				isLoading={isTagsLoading}
				{...(tagsError === undefined ? {} : { error: tagsError })}
				onRetry={loadTagOptions}
			/>
			<LabeledFormControl
				id="show-url"
				name="url"
				label="show URL"
				type="url"
				value={url}
				onChange={setUrl}
				required
			/>
		</OnboardingModal>
	);
};
