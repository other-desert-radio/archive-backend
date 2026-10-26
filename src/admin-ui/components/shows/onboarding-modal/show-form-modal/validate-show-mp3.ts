/** Client selection checks; the upload route must also validate content and size. */
export const validateShowMP3 = (
	file: File,
): { valid: true; file: File } | { valid: false; error: string } => {
	if (!file.name.toLowerCase().endsWith(".mp3"))
		return { valid: false, error: "Choose an MP3 file." };
	if (file.size === 0)
		return { valid: false, error: "The MP3 file must not be empty." };
	if (file.size > 4_000_000_000)
		return { valid: false, error: "The MP3 file must be 4 GB or smaller." };
	return { valid: true, file };
};
