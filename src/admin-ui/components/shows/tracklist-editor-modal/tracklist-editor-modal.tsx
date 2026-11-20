import { useId, useRef, useState } from "react";
import type { ShowTracklistEntry } from "../../../../db/types.js";
import { FormModal, LabeledFormControl } from "../../shared/modal/index.js";
import styles from "./tracklist-editor-modal.module.css";
import { formatTrackTime, parseTrackTime } from "./tracklist-utils.js";

type DraftRow = {
	id: number;
	type: "song" | "chapter";
	artist: string;
	title: string;
	time: string;
};
type Props = {
	entries: ShowTracklistEntry[];
	onSave: (entries: ShowTracklistEntry[]) => void;
	onClose: () => void;
};

/** Edits an ordered local draft; its caller owns persistence. */
export const TracklistEditorModal = ({ entries, onSave, onClose }: Props) => {
	const prefix = useId();
	const [opening] = useState<DraftRow[]>(() =>
		entries.map((entry, id) => ({
			id,
			type: entry.chapter === undefined ? "song" : "chapter",
			artist: entry.artist ?? "",
			title: entry.chapter ?? entry.song ?? "",
			time: formatTrackTime(entry.start_time),
		})),
	);
	const [rows, setRows] = useState(opening);
	const nextId = useRef(entries.length);
	const update = (id: number, changes: Partial<DraftRow>) => {
		setRows((current) =>
			current.map((row) => (row.id === id ? { ...row, ...changes } : row)),
		);
	};
	const values = (draft: DraftRow[]) =>
		draft.map(({ id: _id, ...value }) => value);
	const timeErrors = rows.map((row) => {
		try {
			parseTrackTime(row.time);
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid timestamp.";
		}
	});
	return (
		<FormModal
			isOpen
			panelWidth={1080}
			title={entries.length === 0 ? "Add tracklist" : "Edit Tracklist"}
			subtitle="Enter timestamp as m:ss or h:mm:ss"
			isSubmitDisabled={timeErrors.some((error) => error !== undefined)}
			onClose={onClose}
			submitLabel="Save"
			cancelLabel="Cancel"
			hasUnsavedChanges={
				JSON.stringify(values(rows)) !== JSON.stringify(values(opening))
			}
			onSubmit={async () => {
				const result = rows.map((row, index): ShowTracklistEntry => {
					if (!row.title.trim() || (row.type === "song" && !row.artist.trim()))
						throw new Error(
							`Row ${index + 1}: ${row.type === "song" ? "Artist and song are" : "Chapter is"} required.`,
						);
					let start_time: number | null;
					try {
						start_time = parseTrackTime(row.time);
					} catch (error) {
						throw new Error(
							`Row ${index + 1}: ${error instanceof Error ? error.message : "Invalid timestamp."}`,
						);
					}
					return row.type === "song"
						? { artist: row.artist.trim(), song: row.title.trim(), start_time }
						: { chapter: row.title.trim(), start_time };
				});
				onSave(result);
			}}
		>
			<div className={styles.editor}>
				<div className={styles.tracks}>
					{rows.map((row, index) => (
						<fieldset
							key={row.id}
							className={styles.row}
							data-continuation={rows[index - 1]?.type === row.type}
							aria-label={`Tracklist row ${index + 1}`}
						>
							<span className={styles.number}>{index + 1}</span>
							<div
								className={`${styles.text} ${row.type === "chapter" ? styles.chapter : ""}`}
							>
								{row.type === "song" && (
									<LabeledFormControl
										id={`${prefix}-${row.id}-artist`}
										name="artist"
										label="artist"
										value={row.artist}
										onChange={(artist) => update(row.id, { artist })}
										required
									/>
								)}
								<LabeledFormControl
									id={`${prefix}-${row.id}-title`}
									name={row.type}
									label={row.type}
									value={row.title}
									onChange={(title) => update(row.id, { title })}
									required
								/>
							</div>
							<div className={styles.timestamp}>
								<LabeledFormControl
									id={`${prefix}-${row.id}-time`}
									name="timestamp"
									label="timestamp"
									placeholder="optional"
									value={row.time}
									onChange={(time) => update(row.id, { time })}
									{...(timeErrors[index] === undefined
										? {}
										: { error: timeErrors[index] })}
								/>
							</div>
							<div className={styles.type}>
								<label htmlFor={`${prefix}-${row.id}-type`}>type</label>
								<select
									id={`${prefix}-${row.id}-type`}
									value={row.type}
									onChange={(event) =>
										update(row.id, {
											type:
												event.target.value === "chapter" ? "chapter" : "song",
											artist: "",
											title: "",
										})
									}
								>
									<option value="song">song</option>
									<option value="chapter">chapter</option>
								</select>
							</div>
							<button
								className={styles.remove}
								type="button"
								aria-label={`Remove row ${index + 1}`}
								onClick={() =>
									setRows((current) =>
										current.filter((item) => item.id !== row.id),
									)
								}
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path d="M5 5 19 19M19 5 5 19" />
								</svg>
							</button>
						</fieldset>
					))}
				</div>
				<button
					className={styles.add}
					type="button"
					onClick={() => {
						const id = nextId.current++;
						setRows((current) => [
							...current,
							{
								id,
								type: "song",
								artist: "",
								title: "",
								time: "",
							},
						]);
					}}
				>
					+ Add track
				</button>
			</div>
		</FormModal>
	);
};
