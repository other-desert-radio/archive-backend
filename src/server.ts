import { fileURLToPath } from "node:url";
import { sql } from "kysely";
import { buildApp } from "./app.js";
import { auth } from "./auth/auth.js";
import { db, pool } from "./db/db.js";
import {
	createMixcloudClient,
	createMixcloudStore,
	readMixcloudConfig,
} from "./mixcloud/index.js";
import {
	createPublicationNotifications,
	createPublicationRunner,
	type PublicationNotifications,
	type PublicationRunner,
	readPublicationConfig,
} from "./publication/index.js";

const port = Number(process.env.PORT ?? 43827);
let app: ReturnType<typeof buildApp> | undefined;
let runner: PublicationRunner | undefined;
let notifications: PublicationNotifications | undefined;

const close = async () => {
	try {
		await notifications?.close();
	} finally {
		try {
			await runner?.close();
		} finally {
			await db.destroy();
		}
	}
};

const start = async () => {
	const mixcloudConfig = readMixcloudConfig(process.env);
	const mixcloud = mixcloudConfig
		? {
				client: createMixcloudClient(mixcloudConfig),
				store: createMixcloudStore(db, mixcloudConfig.tokenEncryptionKey),
			}
		: undefined;
	// health check on the database
	await sql`select 1`.execute(db);
	const config = readPublicationConfig(
		process.env,
		fileURLToPath(new URL("../", import.meta.url)),
	);
	runner = await createPublicationRunner(db, config);
	notifications = await createPublicationNotifications(pool);
	app = buildApp(auth, { config, runner, notifications }, mixcloud);
	app.addHook("onClose", close);
	const address = await app.listen({ host: "0.0.0.0", port });
	app.log.info(`Web server running at ${address}`);
};

start().catch(async (error: unknown) => {
	if (app !== undefined) {
		app.log.error(error);
		await app.close();
	} else {
		console.error("Unable to start archive backend", error);
		await close();
	}
	process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		void app?.close().catch(() => {
			process.exitCode = 1;
		});
	});
}
