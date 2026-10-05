import { type ReactNode, useMemo, useRef, useState } from "react";
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
/** A keyboard-accessible, searchable checkbox list for related records. */
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
	const [query, setQuery] = useState("");
	const selectedOptions = useMemo(
		() => options.filter((option) => selectedIds.includes(option.id)),
		[options, selectedIds],
	);
	const visibleOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		return normalizedQuery === ""
			? options
			: options.filter((option) =>
					option.searchText.toLowerCase().includes(normalizedQuery),
				);
	}, [options, query]);
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
								<span key={option.id} className={styles.chip}>
									{option.label}
									<button
										type="button"
										className={styles.remove}
										aria-label={`Remove ${option.label}`}
										onClick={() => {
											toggle(option.id);
											inputRef.current?.focus();
										}}
									>
										x
									</button>
								</span>
							))}
							<input
								ref={inputRef}
								id={id}
								type="search"
								onFocus={() => setIsOpen(true)}
								onKeyDown={(event) => {
									if (event.key === "Escape" && isOpen) {
										event.preventDefault();
										event.stopPropagation();
										setIsOpen(false);
									}
									if (event.key === "ArrowDown") {
										event.preventDefault();
										setIsOpen(true);
										document
											.getElementById(`${id}-options`)
											?.querySelector<HTMLInputElement>("input")
											?.focus();
									}
								}}
								value={query}
								onChange={(event) => {
									setQuery(event.target.value);
									setIsOpen(true);
								}}
								placeholder="Search DJs"
								aria-label={`Search ${label}`}
								aria-describedby={helper ? `${id}-help` : undefined}
							/>
							<button
								type="button"
								className={styles.remove}
								aria-label={`Browse ${label}`}
								aria-expanded={isOpen}
								aria-controls={isOpen ? `${id}-options` : undefined}
								onClick={() => setIsOpen(!isOpen)}
							>
								▾
							</button>
						</div>

						{isOpen && (
							<div id={`${id}-options`} className={styles.options}>
								{visibleOptions.length === 0 ? (
									<p className={styles.message}>
										No {label.toLowerCase()} match your search.
									</p>
								) : (
									visibleOptions.map((option) => (
										<label key={option.id} className={styles.option}>
											<input
												type="checkbox"
												checked={selectedIds.includes(option.id)}
												aria-describedby={helper ? `${id}-help` : undefined}
												onChange={() => toggle(option.id)}
											/>
											{option.label}
										</label>
									))
								)}
							</div>
						)}
					</fieldset>
				)}
				{helper && (
					<div id={`${id}-help`} className={styles.helper}>
						{helper}
					</div>
				)}
			</div>
		</div>
	);
};
