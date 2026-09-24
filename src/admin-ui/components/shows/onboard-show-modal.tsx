import { useEffect, useState } from "react";
import { CommaSeparatedTagsField } from "../shared/comma-separated-tags-field.js";
import { LabeledFormControl } from "../shared/labeled-form-control.js";
import { OnboardingModal } from "../shared/onboarding-modal.js";
import {
	buildCreateShowRequest,
	type CreateShowForm,
} from "./onboard-show-utils.js";

type Props = {
	isOpen: boolean;
	djs: { id: number; title: string }[];
	onClose: () => void;
	onSubmit: (request: CreateShowForm) => Promise<void>;
};
export const OnboardShowModal = ({ isOpen, djs, onClose, onSubmit }: Props) => {
	const [title, setTitle] = useState("");
	const [date, setDate] = useState("");
	const [hours, setHours] = useState("");
	const [minutes, setMinutes] = useState("");
	const [seconds, setSeconds] = useState("");
	const [image, setImage] = useState("");
	const [tags, setTags] = useState("");
	const [url, setUrl] = useState("");
	const [selected, setSelected] = useState<number[]>([]);
	useEffect(() => {
		if (isOpen) {
			setTitle("");
			setDate("");
			setHours("");
			setMinutes("");
			setSeconds("");
			setImage("");
			setTags("");
			setUrl("");
			setSelected([]);
		}
	}, [isOpen]);
	const submit = async () => {
		if (selected.length === 0) throw new Error("Select at least one DJ.");
		await onSubmit(
			buildCreateShowRequest({
				title,
				date,
				hours,
				minutes,
				seconds,
				image,
				tags,
				url,
				djs: selected,
			}),
		);
	};
	return (
		<OnboardingModal
			isOpen={isOpen}
			title="Onboard Show"
			onClose={onClose}
			onSubmit={submit}
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
			<div className="onboarding-modal-field">
				<span>DJs</span>
				<div>
					{djs.length === 0 ? (
						<p>Create a DJ first.</p>
					) : (
						djs.map((dj) => (
							<label key={dj.id}>
								<input
									type="checkbox"
									checked={selected.includes(dj.id)}
									onChange={() =>
										setSelected((value) =>
											value.includes(dj.id)
												? value.filter((id) => id !== dj.id)
												: [...value, dj.id],
										)
									}
								/>{" "}
								{dj.title} (#{dj.id})
							</label>
						))
					)}
				</div>
			</div>
			<CommaSeparatedTagsField id="show-tags" value={tags} onChange={setTags} />
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
