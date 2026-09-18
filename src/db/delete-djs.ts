if (!process.argv.slice(2).includes("--confirm")) {
	console.error("Refusing to delete DJs without --confirm.");
	console.error("Usage: bun src/db/delete-djs.ts --confirm");
	process.exitCode = 1;
} else {
	const { db } = await import("./db.js");

	try {
		const result = await db.deleteFrom("djs").execute();
		console.log(`Deleted ${result[0]?.numDeletedRows ?? 0} DJs.`);
	} finally {
		await db.destroy();
	}
}
