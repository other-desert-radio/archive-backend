import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Kysely } from "kysely";
import { isMatching, P } from "ts-pattern";
import type { auth } from "../auth/auth.js";
import { db as defaultDb } from "../db/db.js";
import type { Database } from "../db/types.js";
import type {
  DJJSON,
  ShowsJSON,
  TagsJSON,
} from "../json-transformers/index.js";
import {
  transformDJs,
  transformShows,
  transformTags,
} from "../json-transformers/index.js";
import { validateTags } from "../utils/validate-tags.js";

type BetterAuth = typeof auth;

// TODO: ensure this is a good name
export type TypedDatabase = Kysely<Database>;

type ErrorResponse = {
  error: string;
};

type AdminApiReply<T> = {
  200: T;
  500: ErrorResponse;
};

type AdminUiRoute = {
  Params: { "*"?: string };
  Reply: {
    200: Buffer;
    404: ErrorResponse;
    503: ErrorResponse;
  };
};

export type BasicAuthCredentials = {
  username: string;
  password: string;
};

const defaultBasicAuthCredentials: BasicAuthCredentials = {
  username: process.env.ADMIN_BASIC_USERNAME ?? "",
  password: process.env.ADMIN_BASIC_PASSWORD ?? "",
};

const hasValidBasicAuth = (
  authorization: string | undefined,
  credentials: BasicAuthCredentials,
): boolean => {
  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  const decoded = Buffer.from(authorization.slice(6), "base64").toString(
    "utf8",
  );
  const separator = decoded.indexOf(":");

  return (
    separator !== -1 &&
    decoded.slice(0, separator) === credentials.username &&
    decoded.slice(separator + 1) === credentials.password &&
    credentials.username !== "" &&
    credentials.password !== ""
  );
};

const requireAuthenticatedAdminAccess = (
  auth: BetterAuth,
  credentials: BasicAuthCredentials,
) => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (hasValidBasicAuth(request.headers.authorization, credentials)) {
      return;
    }

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session?.user) {
      reply
        .header(
          "WWW-Authenticate",
          'Basic realm="Archive Admin", charset="UTF-8"',
        )
        .code(401)
        .send({ error: "Unauthorized" });
      reply.hijack();
      return;
    }

    if (session.user.role !== "admin") {
      reply.code(403).send({ error: "Forbidden" });
      reply.hijack();
      return;
    }
  };
};

const adminApiRoutes = (database: TypedDatabase): FastifyPluginAsync => {
  return async (app) => {
    app.get<{ Reply: { status: string } }>("/", async () => ({
      status: "admin api boundary ready",
    }));

    app.get<{ Reply: AdminApiReply<DJJSON[]> }>(
      "/djs",
      async (request, reply) => {
        try {
          const [djs, showDJs, djTags, showTags] = await Promise.all([
            database
              .selectFrom("djs")
              .select(["id", "title", "bio", "image", "socials"])
              .orderBy("id")
              .execute(),
            database
              .selectFrom("show_djs")
              .select(["dj_id", "show_id"])
              .orderBy("dj_id")
              .orderBy("show_id")
              .execute(),
            database
              .selectFrom("dj_tags")
              .select(["dj_id", "tag_id"])
              .orderBy("dj_id")
              .orderBy("tag_id")
              .execute(),
            database
              .selectFrom("show_djs")
              .innerJoin("show_tags", "show_tags.show_id", "show_djs.show_id")
              .select(["show_djs.dj_id", "show_tags.tag_id"])
              .orderBy("show_djs.dj_id")
              .orderBy("show_tags.tag_id")
              .execute(),
          ]);

          return transformDJs({ djs, showDJs, djTags, showTags });
        } catch (error) {
          request.log.error(error, "Unable to load DJs");
          return reply.code(500).send({ error: "Internal Server Error" });
        }
      },
    );

    app.get<{ Reply: AdminApiReply<ShowsJSON[]> }>(
      "/shows",
      async (request, reply) => {
        try {
          const [shows, showDJs, showTags] = await Promise.all([
            database
              .selectFrom("shows")
              .select(["id", "title", "date", "duration", "image", "url"])
              .orderBy("id")
              .execute(),
            database
              .selectFrom("show_djs")
              .select(["show_id", "dj_id"])
              .orderBy("show_id")
              .orderBy("dj_id")
              .execute(),
            database
              .selectFrom("show_tags")
              .select(["show_id", "tag_id"])
              .orderBy("show_id")
              .orderBy("tag_id")
              .execute(),
          ]);

          return transformShows({ shows, showDJs, showTags });
        } catch (error) {
          request.log.error(error, "Unable to load shows");
          return reply.code(500).send({ error: "Internal Server Error" });
        }
      },
    );

    app.get<{ Reply: AdminApiReply<TagsJSON[]> }>(
      "/tags",
      async (request, reply) => {
        try {
          const tags = await database
            .selectFrom("tags")
            .select(["id", "title", "color"])
            .orderBy("id")
            .execute();

          return transformTags({ tags });
        } catch (error) {
          request.log.error(error, "Unable to load tags");
          return reply.code(500).send({ error: "Internal Server Error" });
        }
      },
    );

    app.post<{
      Body: { tags: string[] };
      Reply: { valid: string[]; invalid: string[] } | { error: string };
    }>("/validate-tags", async (request, reply) => {
      // input: { tags: ["word1", "word", ""] }

      try {
        if (!isMatching({ tags: P.array(P.string) }, request.body)) {
          return reply.code(400).send({
            error: "invalid request body, expected array of strings",
          });
        }

        const { tags } = request.body;

        const { valid, invalid } = await validateTags({ tags, database });

        return {
          valid,
          invalid,
        };
      } catch (error) {
        request.log.error(error, "Unable to validate tags");
        return reply.code(500).send({ error: "Internal Server Error" });
      }
    });

    app.post<{ Reply: undefined }>("/create-dj", async () => {
      // 1. validate body
      // 2. validat tags -> insert invalid tags into table
      //    TODO: add new tags field: reviewed? true if created, false if auto generated
      // 3. insert into DJ table
      return undefined;
    });

    app.post("/modify-tag", async () => {
      // TODO: set reviewed column to true
      //
      return undefined;
    });
  };
};

const adminUiRoutes: FastifyPluginAsync = async (app) => {
  const adminUiRoot = resolve(process.cwd(), "dist/admin");

  const serveAdminFile = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const wildcard = (request.params as { "*"?: string })["*"];
    const relativePath = wildcard || "index.html";
    const filePath = resolve(adminUiRoot, relativePath);

    if (
      filePath !== adminUiRoot &&
      !filePath.startsWith(`${adminUiRoot}${sep}`)
    ) {
      return reply.code(404).send({ error: "Not Found" });
    }

    try {
      const file = await readFile(filePath);
      return reply.type(contentTypeFor(filePath)).send(file);
    } catch (error) {
      request.log.error(error, "Unable to load admin UI asset");
      return reply.code(wildcard ? 404 : 503).send({
        error: wildcard ? "Not Found" : "Admin UI is unavailable",
      });
    }
  };

  app.get<AdminUiRoute>("/", serveAdminFile);
  app.get<AdminUiRoute>("/*", serveAdminFile);
};

const contentTypeFor = (filePath: string): string => {
  switch (extname(filePath)) {
    case ".css":
      return "text/css";
    case ".js":
      return "application/javascript";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json";
    default:
      return "text/html";
  }
};
export const adminRoutes = (
  auth: BetterAuth,
  database: TypedDatabase = defaultDb,
  credentials: BasicAuthCredentials = defaultBasicAuthCredentials,
): FastifyPluginAsync => {
  return async (app) => {
    app.addHook(
      "onRequest",
      requireAuthenticatedAdminAccess(auth, credentials),
    );
    await app.register(adminApiRoutes(database), { prefix: "/api/admin" });
    await app.register(adminUiRoutes, { prefix: "/admin" });
  };
};
