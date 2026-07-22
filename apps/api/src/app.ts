import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { env, corsOrigins } from "./env.js";
import { fail, ok } from "./http.js";
import { prisma } from "@scan-krwalo/database";
import { registerAuthRoutes } from "./modules/auth.routes.js";
import { registerActivationRoutes } from "./modules/activation.routes.js";
import { registerSettingsRoutes } from "./modules/settings.routes.js";
import { registerTaskRoutes } from "./modules/tasks.routes.js";
import { registerScannerRoutes } from "./modules/scanner.routes.js";
import { registerClientRoutes } from "./modules/client.routes.js";
import { registerAdminRoutes } from "./modules/admin.routes.js";
import { registerNotificationRoutes } from "./modules/notifications.routes.js";
import { registerPushRoutes } from "./modules/push.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    genReqId: () => randomUUID(),
    bodyLimit: 1024 * 1024
  });

  await app.register(helmet);
  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  await app.register(jwt, { secret: env.JWT_ACCESS_SECRET });

  app.addHook("preSerialization", async (_, __, payload) => stringifyBigInts(payload));

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, "Request failed");
    return fail(reply, error);
  });

  app.get("/health", async (_, reply) => ok(reply, { status: "ok" }));
  app.get("/ready", async (_, reply) => {
    await prisma.$queryRaw`SELECT 1`;
    return ok(reply, { postgres: "ok", redis: "configured" });
  });

  await app.register(registerAuthRoutes, { prefix: "/api/v1/auth" });
  await app.register(registerActivationRoutes, { prefix: "/api/v1/activation" });
  await app.register(registerSettingsRoutes, { prefix: "/api/v1" });
  await app.register(registerTaskRoutes, { prefix: "/api/v1/tasks" });
  await app.register(registerScannerRoutes, { prefix: "/api/v1/scanner" });
  await app.register(registerClientRoutes, { prefix: "/api/v1/client" });
  await app.register(registerAdminRoutes, { prefix: "/api/v1/admin" });
  await app.register(registerNotificationRoutes, { prefix: "/api/v1/notifications" });
  await app.register(registerPushRoutes, { prefix: "/api/v1/push-subscriptions" });

  return app;
}

function stringifyBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stringifyBigInts);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, stringifyBigInts(item)])
    );
  }
  return value;
}
