import type { Kysely, Selectable, Transaction } from "kysely";
import { isMatching, P } from "ts-pattern";
import type { Database, TagsTable } from "../../../db/types.js";
import { undefinedOrEmpty } from "../../../utils/index.js";

type TagDatabase = Kysely<Database> | Transaction<Database>;

export type CreateTagInput = {
	title: string;
	color?: string | undefined;
};

export type CreatedTag = Pick<
	Selectable<TagsTable>,
	"id" | "title" | "color" | "reviewed"
>;

const randomTagColor = (): string =>
	`#${Math.floor(Math.random() * 0xffffff)
		.toString(16)
		.padStart(6, "0")}`;

/**
 * Creates or reuses one tag within the supplied database context.
 *
 * Explicit colors mark the tag reviewed. Automatically colored tags are
 * unreviewed and receive a random six-digit hexadecimal color.
 *
 * @param database - A database or transaction context.
 * @param input - The tag title and optional explicit color.
 * @returns The existing or newly inserted tag.
 */
export const createTag = async (
	database: TagDatabase,
	input: CreateTagInput,
): Promise<CreatedTag> => {
	const normalized = {
		title: input.title.trim(),
		color: input.color?.trim(),
	};

	if (!isMatching({ title: P.string.minLength(1) }, normalized)) {
		throw new Error("Tag title is required");
	}

	const { color, reviewed } = ((inputColor: string | undefined) => {
		if (undefinedOrEmpty(inputColor)) {
			return {
				color: randomTagColor(),
				reviewed: false,
			};
		} else {
			return {
				color: inputColor,
				reviewed: true,
			};
		}
	})(normalized.color);

	const { title } = normalized;

	const existingTags = await database
		.selectFrom("tags")
		.select(["id", "title", "color", "reviewed"])
		.execute();
	const existingTag = existingTags.find(
		(tag) => tag.title.trim().toLowerCase() === title.toLowerCase(),
	);

	if (existingTag !== undefined) return existingTag;

	return database
		.insertInto("tags")
		.values({
			title,
			color: color ?? randomTagColor(),
			reviewed,
		})
		.returning(["id", "title", "color", "reviewed"])
		.executeTakeFirstOrThrow();
};

/**
 * Creates or reuses a list of tags by delegating each item to `createTag`.
 *
 * @param database - A database or transaction context.
 * @param inputs - Tag titles with optional explicit colors.
 * @returns Unique existing or newly inserted tags in input order.
 */
export const createTags = async (
	database: TagDatabase,
	inputs: CreateTagInput[],
): Promise<CreatedTag[]> => {
	const createdTags: CreatedTag[] = [];
	const seenTitles = new Set<string>();

	for (const input of inputs) {
		const titleKey = input.title.trim().toLowerCase();
		if (seenTitles.has(titleKey)) continue;

		seenTitles.add(titleKey);
		createdTags.push(await createTag(database, input));
	}

	return createdTags;
};
