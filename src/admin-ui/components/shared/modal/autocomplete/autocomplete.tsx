import type { ReactNode } from "react";

const normalize = (value: string) => value.trim().toLocaleLowerCase();

/** Prefix matches come first, followed by other name matches. */
export const findAutocompleteMatches = <T,>(
	draft: string,
	options: T[],
	getTitle: (option: T) => string,
): T[] => {
	const query = normalize(draft);
	return options
		.filter((option) => normalize(getTitle(option)).includes(query))
		.sort((first, second) => {
			const firstPrefix = normalize(getTitle(first)).startsWith(query);
			const secondPrefix = normalize(getTitle(second)).startsWith(query);
			if (firstPrefix !== secondPrefix) return firstPrefix ? -1 : 1;
			return getTitle(first).localeCompare(getTitle(second), undefined, {
				sensitivity: "base",
			});
		});
};

export const getAutocompleteCompletion = (
	draft: string,
	title?: string,
): string | undefined => {
	if (
		title === undefined ||
		draft === "" ||
		!normalize(title).startsWith(normalize(draft))
	)
		return undefined;
	return title.slice(draft.length);
};

/** Keep search focused until the entire option row has committed its selection. */
export const AutocompleteOption = ({
	id,
	selected,
	className,
	onSelect,
	children,
}: {
	id: string;
	selected: boolean;
	className: string;
	onSelect: () => void;
	children: ReactNode;
}) => (
	<button
		id={id}
		type="button"
		role="option"
		aria-selected={selected}
		className={className}
		onMouseDown={(event) => event.preventDefault()}
		onClick={onSelect}
	>
		{children}
	</button>
);
