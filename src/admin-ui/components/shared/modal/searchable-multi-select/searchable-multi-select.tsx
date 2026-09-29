import { useMemo, useState } from "react";
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
}: SearchableMultiSelectProps) => {
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
			<div className={styles.control}>
				{selectedOptions.length > 0 && (
					<ul className={styles.selected} aria-label={`Selected ${label}`}>
						{selectedOptions.map((option) => (
							<li key={option.id}>
								<button type="button" onClick={() => toggle(option.id)}>
									Remove {option.label}
								</button>
							</li>
						))}
					</ul>
				)}
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
					<>
						<input
							id={id}
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search DJs"
							aria-label={`Search ${label}`}
						/>
						<div className={styles.options}>
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
											onChange={() => toggle(option.id)}
										/>
										{option.label}
									</label>
								))
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
};
