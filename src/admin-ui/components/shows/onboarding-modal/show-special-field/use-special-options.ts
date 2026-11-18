import { useCallback, useEffect, useRef, useState } from "react";
import { loadSpecials } from "../../../../loaders/specials.js";

export const useSpecialOptions = () => {
	const [specials, setSpecials] = useState<{ id: number; title: string }[]>([]);
	const [isLoading, setLoading] = useState(true);
	const [error, setError] = useState<string>();
	const version = useRef(0);
	const reload = useCallback(() => {
		const current = ++version.current;
		setLoading(true);
		setError(undefined);
		loadSpecials()
			.then((rows) => {
				if (current === version.current) setSpecials(rows);
			})
			.catch(() => {
				if (current === version.current)
					setError("Specials could not be loaded.");
			})
			.finally(() => {
				if (current === version.current) setLoading(false);
			});
	}, []);
	useEffect(() => {
		reload();
		return () => {
			version.current++;
		};
	}, [reload]);
	const validate = (id: number | null | undefined) => {
		if (id == null) return;
		if (isLoading || error)
			throw new Error("Specials must finish loading before saving.");
		if (!specials.some((special) => special.id === id))
			throw new Error(
				"Selected special no longer exists. Remove it or choose another.",
			);
	};
	return { specials, isLoading, error, reload, validate };
};
