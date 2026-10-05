import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
	AutocompleteOption,
	findAutocompleteMatches,
	getAutocompleteCompletion,
	useChipBackspace,
} from "../autocomplete/index.js";
import styles from "./searchable-multi-select.module.css";

export type SearchableMultiSelectOption = {
	id: number;
	label: string;
	searchText: string;
};
type SearchableMultiSelectProps = {
	id: string;
	label: string;
	options: SearchableMultiSelectOption[];
	selectedIds: number[];
	onChange: (selectedIds: number[]) => void;
	isLoading?: boolean;
	error?: string;
	onRetry?: () => void;
	helper?: ReactNode;
};
/** A searchable relationship combobox with removable chips and inline completion. */
export const SearchableMultiSelect = ({
	id,
	label,
	options,
	selectedIds,
	onChange,
	isLoading = false,
	error,
	onRetry,
	helper,
}: SearchableMultiSelectProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState<number>();
	const [scrollLeft, setScrollLeft] = useState(0);
	const [query, setQuery] = useState("");
	const { armedChip, resetBackspace, handleBackspace } = useChipBackspace(
		selectedIds,
		query,
		() => onChange(selectedIds.slice(0, -1)),
	);
	const selectedOptions = useMemo(() => {
		const byId = new Map(options.map((option) => [option.id, option]));
		return selectedIds.flatMap((id) => {
			const option = byId.get(id);
			return option ? [option] : [];
		});
	}, [options, selectedIds]);
	const visibleOptions = useMemo(
		() =>
			findAutocompleteMatches(
				query,
				options.filter((option) => !selectedIds.includes(option.id)),
				(option) => option.label,
			),
		[options, query, selectedIds],
	);
	const activeMatch = visibleOptions[activeIndex ?? 0];
	const completion = getAutocompleteCompletion(query, activeMatch?.label);
	useEffect(() => {
		if ((activeIndex ?? 0) >= visibleOptions.length) setActiveIndex(undefined);
	}, [activeIndex, visibleOptions.length]);
	const select = (option: SearchableMultiSelectOption) => {
		onChange([...selectedIds, option.id]);
		resetBackspace();
		setQuery("");
		setActiveIndex(undefined);
		inputRef.current?.focus();
	};
	const toggle = (optionId: number) =>
		onChange(
			selectedIds.includes(optionId)
				? selectedIds.filter((selectedId) => selectedId !== optionId)
				: [...selectedIds, optionId],
		);
	return (
		<div className={styles.field}>
			<label htmlFor={id}>{label}</label>
			<div className={`${styles.control} ${helper ? styles.withHelper : ""}`}>
				{isLoading ? (
					<p className={styles.message}>Loading {label.toLowerCase()}…</p>
				) : error !== undefined ? (
					<p className={`${styles.message} ${styles.error}`} role="alert">
						{error}{" "}
						{onRetry !== undefined && (
							<button type="button" onClick={onRetry}>
								Retry
							</button>
						)}
					</p>
				) : options.length === 0 ? (
					<p className={styles.message}>
						Create a DJ first before onboarding a Show.
					</p>
				) : (
					<fieldset
						className={styles.inputGroup}
						aria-label={`${label} selection`}
						onBlur={(event) => {
							if (!event.currentTarget.contains(event.relatedTarget))
								setIsOpen(false);
						}}
					>
						<div className={styles.box}>
							{selectedOptions.map((option) => (
								<span
									key={option.id}
									className={`${styles.chip} ${armedChip === option.id ? styles.armed : ""}`}
								>
									{option.label}
									<button
										type="button"
										className={styles.remove}
										aria-label={`Remove ${option.label}`}
										onClick={() => {
											toggle(option.id);
											resetBackspace();
											inputRef.current?.focus();
										}}
									>
										x
									</button>
								</span>
							))}
							<div className={styles.draftWrap}>
								<div className={styles.preview} aria-hidden="true">
									<span style={{ transform: `translateX(-${scrollLeft}px)` }}>
										{query}
										{completion !== undefined && (
											<span className={styles.completion}>{completion}</span>
										)}
									</span>
								</div>
								<input
									ref={inputRef}
									id={id}
									className={styles.input}
									placeholder="Search DJs"
									value={query}
									role="combobox"
									aria-autocomplete="both"
									aria-expanded={isOpen}
									aria-controls={isOpen ? `${id}-options` : undefined}
									aria-activedescendant={
										isOpen && activeIndex !== undefined
											? `${id}-option-${activeIndex}`
											: undefined
									}
									aria-label={`Search ${label}`}
									aria-describedby={`${id}-search-help${helper ? ` ${id}-help` : ""}`}
									onScroll={(event) =>
										setScrollLeft(event.currentTarget.scrollLeft)
									}
									onFocus={() => setIsOpen(true)}
									onBlur={() => setIsOpen(false)}
									onChange={(event) => {
										setQuery(event.target.value);
										resetBackspace();
										setActiveIndex(undefined);
										setIsOpen(true);
									}}
									onKeyDown={(event) => {
										if (event.nativeEvent.isComposing) return;
										if (handleBackspace(event)) return;
										if (event.key === "Escape" && isOpen) {
											event.preventDefault();
											event.stopPropagation();
											setIsOpen(false);
											setActiveIndex(undefined);
										}
										if (
											(event.key === "ArrowDown" || event.key === "ArrowUp") &&
											visibleOptions.length > 0
										) {
											event.preventDefault();
											setIsOpen(true);
											setActiveIndex((current) =>
												event.key === "ArrowDown"
													? ((current ?? -1) + 1) % visibleOptions.length
													: ((current ?? 0) - 1 + visibleOptions.length) %
														visibleOptions.length,
											);
										}
										if (event.key === "Enter") {
											event.preventDefault();
											if (isOpen && activeMatch) select(activeMatch);
										}
										if (
											event.key === "Tab" &&
											!event.shiftKey &&
											isOpen &&
											completion !== undefined &&
											activeMatch
										) {
											event.preventDefault();
											select(activeMatch);
										}
									}}
								/>
							</div>
						</div>

						{isOpen && (
							<div
								id={`${id}-options`}
								className={styles.options}
								role="listbox"
								aria-label="Matching DJs"
							>
								{visibleOptions.length === 0 ? (
									<p className={styles.message}>
										No {label.toLowerCase()} match your search.
									</p>
								) : (
									visibleOptions.map((option, index) => (
										<AutocompleteOption
											key={option.id}
											id={`${id}-option-${index}`}
											selected={index === activeIndex}
											className={`${styles.option} ${index === activeIndex ? styles.optionActive : ""}`}
											onSelect={() => select(option)}
										>
											{option.label}
										</AutocompleteOption>
									))
								)}
							</div>
						)}
					</fieldset>
				)}
				<p id={`${id}-search-help`} className={styles.helper}>
					Type to search. Press Tab to accept the gray completion.
				</p>
				{helper && (
					<div id={`${id}-help`} className={styles.helper}>
						{helper}
					</div>
				)}
			</div>
		</div>
	);
};
