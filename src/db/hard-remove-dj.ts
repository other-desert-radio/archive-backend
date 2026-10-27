import { createInterface } from "node:readline/promises";
import { sql } from "kysely";

const [idArgument, ...flags] = process.argv.slice(2);
const id = Number(idArgument);
if (
	!idArgument ||
	!/^\d+$/.test(idArgument) ||
	!Number.isSafeInteger(id) ||
	id < 1 ||
	id > 2147483647 ||
	flags.length > 1 ||
	flags.some((flag) => flag !== "--including-shows")
) {
	console.error("Usage: ./scripts/hard-remove-dj <id> [--including-shows]");
	process.exitCode = 1;
} else {
	const { db } = await import("./db.js");
	const includingShows = flags.includes("--including-shows");
	try {
		const deleted = await db.transaction().execute(async (trx) => {
			// Keep the preview exact until confirmation, including concurrent DJ/show links.
			await sql`LOCK TABLE djs, shows, show_djs IN SHARE ROW EXCLUSIVE MODE`.execute(
				trx,
			);
			const dj = await trx
				.selectFrom("djs")
				.select(["id", "title"])
				.where("id", "=", id)
				.executeTakeFirst();
			if (!dj) throw new Error(`DJ ${id} does not exist.`);
			console.log(
				`Permanently delete DJ ${dj.id}: ${JSON.stringify(dj.title)}`,
			);
			const shows = await trx
				.selectFrom("shows")
				.innerJoin("show_djs", "show_djs.show_id", "shows.id")
				.select(["shows.id", "shows.title"])
				.where("show_djs.dj_id", "=", id)
				.orderBy("shows.id")
				.execute();
			if (includingShows) {
				console.log(`Also permanently delete ${shows.length} show(s):`);
				for (const show of shows) {
					console.log(`  ${show.id}: ${JSON.stringify(show.title)}`);
				}
				console.log("Shared shows will also be deleted for every other DJ.");
			} else {
				console.log(`Keep all ${shows.length} linked show(s).`);
			}
			console.log("This cannot be undone. Mixcloud uploads are not deleted.");
			const prompt = createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			let answer: string;
			try {
				answer = await prompt.question(`Type "delete ${id}" to confirm: `);
			} finally {
				prompt.close();
			}
			if (answer !== `delete ${id}`) {
				console.log("Cancelled. Nothing deleted.");
				return;
			}
			if (includingShows && shows.length > 0) {
				await trx
					.deleteFrom("shows")
					.where(
						"id",
						"in",
						shows.map((show) => show.id),
					)
					.execute();
			}
			await trx.deleteFrom("djs").where("id", "=", id).execute();
			return true;
		});
		if (deleted) console.log("Deletion committed.");
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	} finally {
		await db.destroy();
	}
}
