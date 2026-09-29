import {
	type KeyboardEvent,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import styles from "./tags-input.module.css";
import type { TagsInputOption } from "./tags-input-utils.js";
import {
	commitTagDraft,
	findTagMatches,
	getTagCompletion,
	uniqueTagTitles,
} from "./tags-input-utils.js";

export type { TagsInputOption } from "./tags-input-utils.js";

export type TagsInputValue = { tags: string[]; draft: string };
type TagsInputProps = {
	id: string;
	value: TagsInputValue;
	onChange: (value: TagsInputValue) => void;
	options: TagsInputOption[];
	isLoading?: boolean;
	error?: string;
	onRetry?: () => void;
};

/** A Figma-aligned tag combobox with colored chips and inline completion. */
export const TagsInput = ({
	id,
	value,
	onChange,
	options,
	isLoading = false,
	error,
	onRetry,
}: TagsInputProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isFocused, setIsFocused] = useState(false);
	const [activeIndex, setActiveIndex] = useState<number>();
	const [isComposing, setIsComposing] = useState(false);
	const [backspaceArmedTag, setBackspaceArmedTag] = useState<string>();
	const listId = useId();
	const matches = useMemo(
		() => findTagMatches(value.draft, options, value.tags),
		[options, value.draft, value.tags],
	);
	const activeMatch = matches[activeIndex ?? 0];
	const completion = getTagCompletion(value.draft, activeMatch);
	const selectedByTitle = useMemo(
		() =>
			new Map(
				options.map((option) => [option.title.toLocaleLowerCase(), option]),
			),
		[options],
	);
	const unknownTags = value.tags.filter(
		(tag) => !selectedByTitle.has(tag.toLocaleLowerCase()),
	);
	const canIdentifyUnknownTags = !isLoading && error === undefined;
	const isOpen = isFocused && value.draft.trim() !== "" && matches.length > 0;
	useEffect(() => {
		if ((activeIndex ?? 0) >= matches.length) setActiveIndex(undefined);
	}, [activeIndex, matches.length]);
	const commit = (draft = value.draft) => {
		const tags = commitTagDraft(value.tags, draft);
		onChange({ tags, draft: "" });
		setActiveIndex(undefined);
		setBackspaceArmedTag(undefined);
	};
	const select = (option: TagsInputOption) => {
		onChange({
			tags: uniqueTagTitles([...value.tags, option.title]),
			draft: "",
		});
		setActiveIndex(undefined);
		setBackspaceArmedTag(undefined);
		inputRef.current?.focus();
	};
	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (isComposing) return;
		if (event.key === "Backspace" && value.draft === "") {
			const lastTag = value.tags.at(-1);
			if (lastTag === undefined) return;
			event.preventDefault();
			if (backspaceArmedTag === lastTag) {
				onChange({
					tags: value.tags.slice(0, -1),
					draft: "",
				});
				setBackspaceArmedTag(undefined);
			} else setBackspaceArmedTag(lastTag);
			return;
		}
		if (event.key === "ArrowDown" && matches.length > 0) {
			event.preventDefault();
			setBackspaceArmedTag(undefined);
			setActiveIndex((current) => ((current ?? -1) + 1) % matches.length);
			return;
		}
		if (event.key === "ArrowUp" && matches.length > 0) {
			event.preventDefault();
			setBackspaceArmedTag(undefined);
			setActiveIndex(
				(current) => ((current ?? 0) - 1 + matches.length) % matches.length,
			);
			return;
		}
		if (event.key === "Escape" && isOpen) {
			event.preventDefault();
			event.stopPropagation();
			setIsFocused(false);
			setActiveIndex(undefined);
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			if (activeIndex !== undefined && activeMatch !== undefined)
				select(activeMatch);
			else commit();
			return;
		}
		if (event.key === ",") {
			event.preventDefault();
			commit();
			return;
		}
		if (event.key === "Tab" && !event.shiftKey && completion !== undefined) {
			event.preventDefault();
			select(activeMatch as TagsInputOption);
		}
	};
	const commitOnBlur = () =>
		window.setTimeout(() => {
			setIsFocused(false);
			commit();
		});
	return (
		<div className={styles.field}>
			<label htmlFor={id}>tags</label>
			<div className={styles.control}>
				<div className={styles.box}>
					{value.tags.map((tag) => {
						const option = selectedByTitle.get(tag.toLocaleLowerCase());
						return (
							<span
								key={tag.toLocaleLowerCase()}
								className={`${styles.chip} ${
									option === undefined && canIdentifyUnknownTags
										? styles.unknown
										: ""
								} ${backspaceArmedTag === tag ? styles.armed : ""}`}
								{...(option === undefined
									? {}
									: { style: { background: option.color } })}
							>
								{tag}
								<button
									type="button"
									className={styles.remove}
									aria-label={`Remove ${tag}`}
									onClick={() => {
										onChange({
											tags: value.tags.filter((selected) => selected !== tag),
											draft: value.draft,
										});
										setBackspaceArmedTag(undefined);
										inputRef.current?.focus();
									}}
								>
									x
								</button>
							</span>
						);
					})}
					<div className={styles.draftWrap}>
						<span className={styles.typed} aria-hidden="true">
							{value.draft}
						</span>
						{completion !== undefined && (
							<span
								className={styles.completion}
								aria-hidden="true"
								style={{ left: `calc(0.25rem + ${value.draft.length}ch)` }}
							>
								{completion}
							</span>
						)}
						<input
							ref={inputRef}
							id={id}
							className={styles.input}
							value={value.draft}
							onChange={(event) => {
								const nextDraft = event.target.value;
								if (nextDraft.includes(","))
									onChange({
										tags: commitTagDraft(value.tags, nextDraft),
										draft: "",
									});
								else onChange({ tags: value.tags, draft: nextDraft });
								setActiveIndex(undefined);
								setBackspaceArmedTag(undefined);
							}}
							onFocus={() => setIsFocused(true)}
							onBlur={commitOnBlur}
							onKeyDown={handleKeyDown}
							onCompositionStart={() => setIsComposing(true)}
							onCompositionEnd={() => setIsComposing(false)}
							role="combobox"
							aria-autocomplete="both"
							aria-expanded={isOpen}
							aria-controls={isOpen ? listId : undefined}
							aria-activedescendant={
								activeIndex === undefined
									? undefined
									: `${listId}-${activeIndex}`
							}
							aria-describedby={`${id}-help`}
						/>
					</div>
				</div>
				{isOpen && (
					<div
						id={listId}
						className={styles.menu}
						role="listbox"
						aria-label="Matching tags"
					>
						{matches.map((option, index) => (
							<button
								key={option.id}
								id={`${listId}-${index}`}
								type="button"
								role="option"
								aria-selected={index === activeIndex}
								className={`${styles.option} ${index === activeIndex ? styles.optionActive : ""}`}
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => select(option)}
							>
								<span
									className={styles.optionTag}
									style={{ background: option.color }}
								>
									{option.title}
								</span>
							</button>
						))}
					</div>
				)}
			</div>
			<p
				id={`${id}-help`}
				className={`${styles.helper} ${error === undefined ? "" : styles.error}`}
			>
				{error !== undefined
					? `${error} You can still add tags manually.`
					: isLoading
						? "Loading existing tags…"
						: canIdentifyUnknownTags && unknownTags.length > 0
							? `The tag${unknownTags.length === 1 ? "" : "s"} ${unknownTags.map((tag) => `“${tag}”`).join(", ")} ${unknownTags.length === 1 ? "does" : "do"} not exist elsewhere. ${unknownTags.length === 1 ? "It" : "They"} will be created after submit.`
							: "Type to search. Press Tab to accept the gray completion."}
				{error !== undefined && onRetry !== undefined && (
					<button type="button" onClick={onRetry}>
						Retry
					</button>
				)}
			</p>
		</div>
	);
};
