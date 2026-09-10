import Fastify from "fastify";
import { sql } from "kysely";
import { db } from "./db.js";

const port = Number(process.env.PORT ?? 3000);
const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

app.addHook("onClose", async () => {
	await db.destroy();
});

const start = async () => {
	// health check on the database
	await sql`select 1`.execute(db);
	await app.listen({ host: "0.0.0.0", port });
};

start().catch(async (error: unknown) => {
	app.log.error(error);
	await app.close();
	process.exit(1);
});
