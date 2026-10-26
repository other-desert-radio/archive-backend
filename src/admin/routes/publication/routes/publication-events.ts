import type { FastifyReply, FastifyRequest } from "fastify";
import { AccountError, getAccountSession } from "../../../../auth/access.js";
import {
	readPublicationJob,
	readPublicationStatus,
} from "../../../../publication/index.js";
import type { PublicationRouteDependencies } from "../types.js";

export const publicationEventsHandler =
	(
		auth: PublicationRouteDependencies["auth"],
		database: PublicationRouteDependencies["database"],
		config: PublicationRouteDependencies["config"],
		notifications: PublicationRouteDependencies["notifications"],
		streams: Set<() => void>,
	) =>
	async (request: FastifyRequest, reply: FastifyReply) => {
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
	};
