if (!process.argv.slice(2).includes("--confirm")) {
	console.error("Refusing to delete shows without --confirm.");
	console.error("Usage: bun src/db/delete-shows.ts --confirm");
	process.exitCode = 1;
} else {
	const { db } = await import("./db.js");

	try {
		const result = await db.deleteFrom("shows").execute();
		console.log(`Deleted ${result[0]?.numDeletedRows ?? 0} shows.`);
	} finally {
		await db.destroy();
	}
}
