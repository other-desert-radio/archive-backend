import type { FastifyReply, FastifyRequest } from "fastify";
import {
	safeUserColumns,
	sendAccountError,
} from "../../../../auth/accounts.js";
import type { TypedDatabase } from "../../types.js";
import type { ListUsersRoute } from "../types.js";

export const listUsersHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ListUsersRoute>,
		reply: FastifyReply<ListUsersRoute>,
	) => {
		try {
			const users = await database
				.selectFrom("user")
				.leftJoin(
					"mixcloud_connections",
					"mixcloud_connections.user_id",
					"user.id",
				)
				.select(safeUserColumns.map((column) => `user.${column}` as const))
				.select([
					"user.banned",
					"user.banReason",
					"user.banExpires",
					"mixcloud_connections.display_name as mixcloudName",
					"mixcloud_connections.mixcloud_key as mixcloudKey",
				])
				.orderBy("email")
				.execute();
			request.log.info(
				{ count: users.length },
				`[Accounts] accounts listed -- count: ${users.length}`,
			);
			return users.map((user) => ({
				...user,
				banReason: user.banReason ?? undefined,
				banExpires: user.banExpires?.toISOString(),
				mixcloudName: user.mixcloudName ?? undefined,
				mixcloudKey: user.mixcloudKey ?? undefined,
			}));
		} catch (error) {
			return sendAccountError(error, request, reply);
		}
	};
