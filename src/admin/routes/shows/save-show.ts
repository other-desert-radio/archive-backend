import type { Transaction } from "kysely";
import type { Database } from "../../../db/types.js";
import { createTags } from "../tags/tag-service.js";
import type { TypedDatabase } from "../types.js";
import type { NormalizedCreateShowRequest } from "./normalize-create-show-request.js";
import type { AdminShowsJSON } from "./types.js";

/** Atomically creates or replaces a Show and its relationships. */
export const saveShow = async (
	database: TypedDatabase,
	normalized: NormalizedCreateShowRequest,
	id?: number,
): Promise<AdminShowsJSON | undefined> =>
	database
		.transaction()
		.execute((transaction) =>
			saveShowInTransaction(transaction, normalized, id),
		);

/**
 * Creates or replaces a Show, validates its DJs, and saves its tag/DJ links
 * within the supplied transaction. The caller owns commit and rollback, so an
 * import can save the Show and its tracking markers as one atomic operation.
 */
export const saveShowInTransaction = async (
	transaction: Transaction<Database>,
	normalized: NormalizedCreateShowRequest,
	id?: number,
): Promise<AdminShowsJSON | undefined> => {
	const existingDJs = await transaction
		.selectFrom("djs")
		.select("id")
		.where("id", "in", normalized.djs)
		.execute();
	if (existingDJs.length !== normalized.djs.length)
		throw new Error("One or more selected DJs do not exist");

	const values = {
		title: normalized.title,
		...(normalized.description === undefined
			? {}
			: { description: normalized.description }),
		date: normalized.date,
		duration: normalized.duration,
		mixcloud_image_small: normalized.mixcloud_image_small,
		mixcloud_image_large: normalized.mixcloud_image_large,
		url: normalized.url,
	};
	const show =
		id === undefined
			? await transaction
					.insertInto("shows")
					.values(values)
					.returning(["id", "createdAt", "description"])
					.executeTakeFirstOrThrow()
			: await transaction
					.updateTable("shows")
					.set(values)
					.where("id", "=", id)
					.returning(["id", "createdAt", "description"])
					.executeTakeFirst();
	if (show === undefined) return undefined;

	const tags = await createTags(
		transaction,
		normalized.tags.map((title) => ({ title })),
	);
	if (id !== undefined) {
		await transaction
			.deleteFrom("show_djs")
			.where("show_id", "=", id)
			.execute();
		await transaction
			.deleteFrom("show_tags")
			.where("show_id", "=", id)
			.execute();
	}
	await transaction
		.insertInto("show_djs")
		.values(
			normalized.djs.map((djId) => ({
				show_id: show.id,
				dj_id: djId,
			})),
		)
		.execute();
	if (tags.length > 0) {
		await transaction
			.insertInto("show_tags")
			.values(
				tags.map((tag) => ({
					show_id: show.id,
					tag_id: tag.id,
				})),
			)
			.execute();
	}
	return {
		id: show.id,
		createdAt: show.createdAt,
		...(show.description == null ? {} : { description: show.description }),
		title: normalized.title,
		date: normalized.date,
		duration: normalized.duration,
		image: normalized.mixcloud_image_large,
		mixcloud_image_small: normalized.mixcloud_image_small,
		mixcloud_image_large: normalized.mixcloud_image_large,
		url: normalized.url,
		djs: [...normalized.djs].sort((a, b) => a - b),
		tags: tags.map((tag) => tag.id).sort((a, b) => a - b),
	};
};

/** Read persisted fields and relationships for idempotent save responses. */
export const loadSavedShow = async (
	transaction: Transaction<Database>,
	id: number,
): Promise<AdminShowsJSON> => {
	const show = await transaction
		.selectFrom("shows")
		.select([
			"id",
			"createdAt",
			"title",
			"description",
			"date",
			"duration",
			"url",
			"mixcloud_image_small",
			"mixcloud_image_large",
		])
		.where("id", "=", id)
		.executeTakeFirstOrThrow();
	const djs = await transaction
		.selectFrom("show_djs")
		.select("dj_id")
		.where("show_id", "=", show.id)
		.orderBy("dj_id")
		.execute();
	const tags = await transaction
		.selectFrom("show_tags")
		.select("tag_id")
		.where("show_id", "=", show.id)
		.orderBy("tag_id")
		.execute();
	const { description, ...fields } = show;
	return {
		...fields,
		...(description == null ? {} : { description }),
		image: show.mixcloud_image_large,
		djs: djs.map(({ dj_id }) => dj_id),
		tags: tags.map(({ tag_id }) => tag_id),
	};
};
