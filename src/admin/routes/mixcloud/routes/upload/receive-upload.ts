import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyRequest } from "fastify";
import { parseFile } from "music-metadata";
import sharp from "sharp";
import { isMatching, P } from "ts-pattern";

const maxMP3Bytes = 4_000_000_000;
const maxImageBytes = 10_000_000;

/** Streams untrusted audio to a server-owned path; the caller owns cleanup. */
export const receiveUpload = async (request: FastifyRequest, path: string) => {
	const reject = (reason: string): false => {
		request.log.warn({ reason }, "[Mixcloud Upload] rejected");
		return false;
	};
	if (!request.isMultipart()) return reject("multipart_required");
	const fields: Record<string, unknown> = {};
	const seen = new Set<string>();
	let valid = true;
	let imagePath: string | undefined;
	// Drain rejected parts so multipart streams can finish without retaining their bytes.
	for await (const part of request.parts({
		limits: {
			fileSize: maxMP3Bytes,
			files: 2,
			fields: 16,
			parts: 18,
			fieldSize: 16_384,
		},
	})) {
		request.log.info(
			{ partType: part.type },
			"[Mixcloud Upload] multipart part received",
		);
		if (seen.has(part.fieldname)) {
			request.log.warn(
				{ reason: "duplicate_field" },
				"[Mixcloud Upload] invalid part",
			);
			valid = false;
			if (part.type === "file") part.file.resume();
			continue;
		}
		seen.add(part.fieldname);
		if (part.type === "file") {
			if (part.fieldname === "image") {
				if (
					part.mimetype !== "image/webp" ||
					!part.filename.toLowerCase().endsWith(".webp")
				) {
					part.file.resume();
					valid = reject("unsupported_image_type");
					continue;
				}
				imagePath = join(dirname(path), "image.webp");
				let bytes = 0;
				await pipeline(
					part.file,
					// Count bytes as they pass through; abort with 413 before oversized images reach disk.
					new Transform({
						transform(chunk: Buffer, _encoding, callback) {
							bytes += chunk.length;
							callback(
								bytes > maxImageBytes
									? Object.assign(new Error("Image too large"), {
											statusCode: 413,
										})
									: null,
								chunk,
							);
						},
					}),
					// wx refuses to overwrite an existing file; 0o600 allows only its owner to read/write.
					createWriteStream(imagePath, { flags: "wx", mode: 0o600 }),
				);
				if (bytes === 0 || part.file.truncated)
					valid = reject("empty_or_truncated_image");
				request.log.info({ bytes }, "[Mixcloud Upload] image received");
				continue;
			}
			if (
				part.fieldname !== "mp3" ||
				!part.filename.toLowerCase().endsWith(".mp3")
			) {
				request.log.warn(
					{ reason: "unexpected_file_or_extension" },
					"[Mixcloud Upload] invalid part",
				);
				part.file.resume();
				valid = false;
				continue;
			}
			request.log.info("[Mixcloud Upload] streaming MP3 to temporary storage");
			// Backpressure keeps large uploads off the heap; never trust a client filename as a path.
			await pipeline(
				part.file,
				createWriteStream(path, { flags: "wx", mode: 0o600 }),
			);
			const { size } = await stat(path);
			request.log.info(
				{ bytes: size, truncated: part.file.truncated },
				"[Mixcloud Upload] MP3 received",
			);
			if (part.file.truncated || size === 0)
				return reject("empty_or_truncated_audio");
		} else {
			if (
				!["title", "date", "tags", "description"].includes(part.fieldname) ||
				part.valueTruncated
			) {
				request.log.warn(
					{ reason: "unknown_or_truncated_field" },
					"[Mixcloud Upload] invalid part",
				);
				valid = false;
				continue;
			}
			fields[part.fieldname] = part.value;
		}
	}
	// Multipart encoders use CRLF; restore textarea line breaks before checking length.
	if (typeof fields.description === "string")
		fields.description = fields.description.replace(/\r\n/g, "\n");
	if (
		!valid ||
		!seen.has("mp3") ||
		!isMatching(
			{
				title: P.string,
				date: P.string,
				tags: P.string,
				description: P.optional(P.string.maxLength(1000)),
			},
			fields,
		)
	)
		return reject("missing_or_invalid_parts");
	if (!fields.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(fields.date))
		return reject("invalid_title_or_date");
	// Round-trip the date because JavaScript normalizes impossible dates such as February 30.
	const date = new Date(`${fields.date}T00:00:00.000Z`);
	if (
		!Number.isFinite(date.getTime()) ||
		date.toISOString().slice(0, 10) !== fields.date
	)
		return reject("invalid_calendar_date");
	let tags: unknown;
	try {
		tags = JSON.parse(fields.tags);
	} catch {
		return reject("invalid_tags_json");
	}
	if (
		!isMatching(P.array(P.string.minLength(1)), tags) ||
		tags.length > 5 ||
		tags.some((tag) => !tag.trim())
	)
		return reject("invalid_tags");
	request.log.info(
		{ tagCount: tags.length },
		"[Mixcloud Upload] metadata validated; parsing audio",
	);
	try {
		// Parse the disk file without extracting artwork or scanning for exact duration.
		const { format } = await parseFile(path, { skipCovers: true });
		if (
			format.container !== "MPEG" ||
			!format.codec?.endsWith("Layer 3") ||
			!format.sampleRate
		)
			return reject("unsupported_audio_format");
		request.log.info(
			{
				codec: format.codec,
				sampleRate: format.sampleRate,
				channels: format.numberOfChannels,
			},
			"[Mixcloud Upload] audio parsed",
		);
	} catch (error) {
		// Filesystem failures are server errors; malformed media is invalid input.
		if (isMatching({ code: P.string }, error)) throw error;
		return reject("audio_parse_failed");
	}

	if (imagePath !== undefined) {
		try {
			const image = sharp(imagePath, { limitInputPixels: 1200 * 1200 });
			const metadata = await image.metadata();
			if (
				metadata.format !== "webp" ||
				metadata.width !== 1200 ||
				metadata.height !== 1200 ||
				(metadata.pages ?? 1) !== 1
			)
				return reject("unsupported_image_dimensions_or_format");
			// Decode every pixel so a valid header cannot hide a truncated image.
			await image.stats();
		} catch (error) {
			if (isMatching({ code: P.string }, error)) throw error;
			return reject("image_parse_failed");
		}
	}

	return {
		...(imagePath === undefined ? {} : { imagePath }),
		title: fields.title.trim(),
		...(fields.description === undefined
			? {}
			: { description: fields.description }),
		date: fields.date,
		tags: tags.map((tag) => tag.trim()),
		path,
	};
};
