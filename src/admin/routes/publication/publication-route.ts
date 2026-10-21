import type { FastifyPluginAsync } from "fastify";
import { isMatching, P } from "ts-pattern";
import {
	AccountError,
	accountAccessGuard,
	getAccountSession,
} from "../../../auth/access.js";
import type { ArchiveAuth } from "../../../auth/auth.js";
import type {
	PublicationConfig,
	PublicationJob,
	PublicationJobDetail,
	PublicationNotifications,
	PublicationRunner,
	PublicationStatus,
} from "../../../publication/index.js";
import {
	PublicationBusyError,
	PublicationRequestError,
	readPublicationJob,
	readPublicationStatus,
} from "../../../publication/index.js";
import type { ErrorResponse, TypedDatabase } from "../types.js";
export type PublicationRouteDependencies = {
	auth: ArchiveAuth;
	database: TypedDatabase;
	config: PublicationConfig;
	runner: PublicationRunner;
	notifications: PublicationNotifications;
};
export type PublicationRouteReply<T> = {
	200: T;
	400: ErrorResponse;
	401: ErrorResponse;
	403: ErrorResponse;
	404: ErrorResponse;
	409: ErrorResponse;
	500: ErrorResponse;
	503: ErrorResponse;
};
export type PublicationStatusRoute = {
	Reply: PublicationRouteReply<PublicationStatus>;
};
export type PublicationStartRoute = {
	Body: unknown;
	Reply: PublicationRouteReply<PublicationJob> & { 202: PublicationJob };
};
export type PublicationJobRoute = {
	Params: { jobId: string };
	Reply: PublicationRouteReply<PublicationJobDetail>;
};
/** GET/POST /publication, GET /publication/jobs/:jobId, GET /publication/events.
 * Admin-only beneath shared session/origin guards; SSE revalidates sessions.
 * Initial connection and reconnect read durable state before forwarding updates.
 */

export const publicationRoutes =
	({
		auth,
		database,
		config,
		runner,
		notifications,
	}: PublicationRouteDependencies): FastifyPluginAsync =>
	async (app) => {
		const streams = new Set<() => void>();
		app.addHook("preClose", async () => {
			for (const close of streams) close();
		});
		app.addHook("onRequest", accountAccessGuard(auth, true));
		app.get<PublicationStatusRoute>("/publication", async (request, reply) => {
			try {
				return await readPublicationStatus(database, config);
			} catch (error) {
				request.log.error({ err: error }, "[Publication] status read failed");
				return reply.code(500).send({
					error: `Could not load publication status. Reload status to try again. Request ID: ${request.id}.`,
				});
			}
		});
		app.get<PublicationJobRoute>(
			"/publication/jobs/:jobId",
			async (request, reply) => {
				if (
					!isMatching(
						P.string.regex(
							/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
						),
						request.params.jobId,
					)
				)
					return reply.code(400).send({ error: "Invalid job ID" });
				try {
					const detail = await readPublicationJob(
						database,
						request.params.jobId,
					);
					return detail === undefined
						? reply.code(404).send({ error: "Not Found" })
						: detail;
				} catch (error) {
					request.log.error({ err: error }, "[Publication] job read failed");
					return reply.code(500).send({
						error: `Could not load the publication job and logs. Reload status to try again. Request ID: ${request.id}.`,
					});
				}
			},
		);
		app.post<PublicationStartRoute>("/publication", async (request, reply) => {
			const body: unknown = request.body ?? {};
			if (
				Array.isArray(body) ||
				!isMatching(
					{
						retryJobId: P.optional(
							P.string.regex(
								/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
							),
						),
					},
					body,
				) ||
				Object.keys(body).some((key) => key !== "retryJobId")
			)
				return reply.code(400).send({ error: "Invalid publication request" });
			try {
				const session = await getAccountSession(auth, request);
				if (body.retryJobId !== undefined) {
					const detail = await readPublicationJob(database, body.retryJobId);
					if (detail === undefined)
						return reply.code(404).send({ error: "Retry job not found" });
					if (
						detail.job.outcome !== "failed" &&
						detail.job.outcome !== "interrupted"
					)
						return reply.code(409).send({
							error: "Only failed or interrupted jobs can be retried",
						});
				}
				const job = await runner.start({
					requestedBy: session.user.id,
					...(body.retryJobId === undefined
						? {}
						: { retryJobId: body.retryJobId }),
				});
				request.log.info(
					{ jobId: job.id },
					`[Publication] job started -- id: ${job.id}, mode: ${config.mode}, branch: ${job.target.branch ?? "none"}`,
				);
				return reply.code(202).send(job);
			} catch (error) {
				if (error instanceof PublicationRequestError) {
					request.log.warn(
						{ statusCode: error.statusCode },
						"[Publication] start rejected -- invalid state",
					);
					return reply.code(error.statusCode).send({ error: error.message });
				}
				if (error instanceof PublicationBusyError) {
					request.log.warn(
						"[Publication] start rejected -- another job is running",
					);
					return reply.code(409).send({ error: error.message });
				}
				if (error instanceof AccountError)
					return reply
						.code(error.status === 401 ? 401 : 403)
						.send({ error: error.message });
				request.log.error({ err: error }, "[Publication] start failed");
				return reply.code(500).send({
					error: `Could not start publication. Reload status to check whether a job was created before retrying. Request ID: ${request.id}.`,
				});
			}
		});
		app.get("/publication/events", async (request, reply) => {
			reply.hijack();
			reply.raw.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no",
			});
			let closed = false;
			let reading = false;
			let pending = false;
			let previous = "";
			const cleanup = () => {
				if (closed) return;
				closed = true;
				streams.delete(cleanup);
				unsubscribe();
				clearInterval(poll);
				clearInterval(heartbeat);
				reply.raw.end();
			};
			const refresh = async () => {
				if (closed) return;
				if (reading) {
					pending = true;
					return;
				}
				reading = true;
				try {
					const session = await getAccountSession(auth, request);
					if (session.user.role !== "admin") {
						cleanup();
						return;
					}
					const status = await readPublicationStatus(database, config);
					const detail =
						status.latestJob === undefined
							? undefined
							: await readPublicationJob(database, status.latestJob.id);
					const serialized = JSON.stringify({ status, detail });
					if (serialized !== previous && !closed) {
						previous = serialized;
						reply.raw.write(
							`data: ${JSON.stringify({ type: "status", status })}\n\n`,
						);
						if (detail !== undefined)
							reply.raw.write(
								`data: ${JSON.stringify({ type: "job", detail })}\n\n`,
							);
						if (reply.raw.writableLength > 1_048_576) cleanup();
					}
				} catch (error) {
					if (!(error instanceof AccountError))
						request.log.error(
							{ err: error },
							"[Publication] event stream read failed",
						);
					cleanup();
				} finally {
					reading = false;
					if (pending && !closed) {
						pending = false;
						void refresh();
					}
				}
			};
			const unsubscribe = notifications.subscribe(
				() => {
					void refresh();
				},
				(error) => {
					request.log.warn(
						{ err: error },
						"[Publication] notification connection interrupted; polling durable state",
					);
				},
			);
			const poll = setInterval(() => {
				void refresh();
			}, 2000);
			const heartbeat = setInterval(() => {
				if (!closed) reply.raw.write(": heartbeat\n\n");
			}, 15000);
			streams.add(cleanup);
			reply.raw.on("close", cleanup);
			void refresh();
		});
	};
