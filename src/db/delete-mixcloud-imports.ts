if (!process.argv.slice(2).includes("--confirm")) {
	console.error("Refusing to delete Mixcloud imports without --confirm.");
	console.error("Usage: bun src/db/delete-mixcloud-imports.ts --confirm");
	process.exitCode = 1;
} else {
	const { db } = await import("./db.js");

	try {
		const result = await db.deleteFrom("mixcloud_import").execute();
		console.log(`Deleted ${result[0]?.numDeletedRows ?? 0} Mixcloud imports.`);
	} finally {
		await db.destroy();
	}
}
