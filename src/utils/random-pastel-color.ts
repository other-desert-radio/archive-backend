/** Generates a lowercase hex color with hue 0–360°, saturation 45–65%, and lightness 78–86%. */
export const randomPastelColor = (): string => {
	const hue = Math.random() * 360;
	const saturation = 0.45 + Math.random() * 0.2;
	const lightness = 0.78 + Math.random() * 0.08;
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
	const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const offset = lightness - chroma / 2;

	const channels = (() => {
		switch (Math.floor(hue / 60)) {
			case 0:
				return [chroma, secondary, 0];
			case 1:
				return [secondary, chroma, 0];
			case 2:
				return [0, chroma, secondary];
			case 3:
				return [0, secondary, chroma];
			case 4:
				return [secondary, 0, chroma];
			default:
				return [chroma, 0, secondary];
		}
	})();

	return `#${channels
		.map((channel) =>
			Math.round((channel + offset) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
};
