import { type KeyboardEvent, useState } from "react";

/** Empty-draft Backspace first arms the last chip, then removes it. */
export const useChipBackspace = <T>(
	selected: T[],
	draft: string,
	onRemoveLast: () => void,
) => {
	const [armedChip, setArmedChip] = useState<T>();
	const resetBackspace = () => setArmedChip(undefined);
	const handleBackspace = (event: KeyboardEvent<HTMLInputElement>): boolean => {
		if (event.nativeEvent.isComposing) return false;
		if (event.key !== "Backspace" || draft !== "") {
			resetBackspace();
			return false;
		}
		const lastChip = selected.at(-1);
		if (lastChip === undefined) return false;
		event.preventDefault();
		if (armedChip === lastChip) {
			onRemoveLast();
			resetBackspace();
		} else setArmedChip(lastChip);
		return true;
	};
	return { armedChip, resetBackspace, handleBackspace };
};
