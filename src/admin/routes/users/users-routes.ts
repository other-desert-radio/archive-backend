import type { FastifyPluginAsync } from "fastify";
import { accountAccessGuard } from "../../../auth/access.js";
import type { ArchiveAuth } from "../../../auth/auth.js";
import type { TypedDatabase } from "../types.js";
import { createUserHandler } from "./routes/create-user.js";
import { listUsersHandler } from "./routes/list-users.js";
import { modifyUserRoleHandler } from "./routes/modify-user-role.js";
import { removeUserHandler } from "./routes/remove-user.js";
import { resetUserPasswordHandler } from "./routes/reset-user-password.js";
import type {
	CreateUserRoute,
	ListUsersRoute,
	ModifyUserRoleRoute,
	RemoveUserRoute,
	ResetUserPasswordRoute,
} from "./types.js";

/** Authenticated administrators manage accounts through serialized library calls. */
export const userRoutes =
	(auth: ArchiveAuth, database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.addHook("onRequest", accountAccessGuard(auth, true));
		app.get<ListUsersRoute>("/users", listUsersHandler(database));
		app.post<CreateUserRoute>("/create-user", createUserHandler(database));
		app.post<ModifyUserRoleRoute>(
			"/modify-user-role",
			modifyUserRoleHandler(database),
		);
		app.post<ResetUserPasswordRoute>(
			"/reset-user-password",
			resetUserPasswordHandler(database),
		);
		app.post<RemoveUserRoute>("/remove-user", removeUserHandler(database));
	};
