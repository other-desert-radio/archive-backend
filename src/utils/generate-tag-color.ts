/** Generates lowercase hex with hue 0–360°, saturation 84–96%, and lightness 62–77%. */
export const generateTagColor = (): string => {
	const hue = Math.random() * 360;
	const saturation = 0.84 + Math.random() * 0.12;
	const lightness = 0.62 + Math.random() * 0.15;
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
