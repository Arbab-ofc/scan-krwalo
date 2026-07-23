import type { FastifyInstance } from "fastify";
import { authenticate } from "../authz.js";
import { ok } from "../http.js";
import { getPushConfig, sendPushNotificationNow } from "../services/push.service.js";
import { prisma } from "@scan-krwalo/database";

export async function registerPushRoutes(app: FastifyInstance) {
  app.get("/public-key", async (_, reply) => ok(reply, getPushConfig()));

  app.post("/", async (request, reply) => {
    const user = await authenticate(request);
    const body = request.body as { token?: unknown };
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) return reply.code(400).send({ success: false, error: { message: "Firebase registration token is required." } });
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint: token },
      update: { userId: user.id, keys: { provider: "firebase" } },
      create: { userId: user.id, endpoint: token, keys: { provider: "firebase" } }
    });
    return ok(reply, { provider: "firebase", subscriptionId: subscription.id }, 201);
  });

  app.post("/test", async (request, reply) => {
    const user = await authenticate(request);
    const result = await sendPushNotificationNow(user.id, {
      title: "Scan Krwalo test",
      body: "Browser push notifications are working on this device.",
      url: "/scanner/live-tasks",
      tag: "push-test"
    });
    return ok(reply, result);
  });

  app.delete("/:id", async (request, reply) => {
    const user = await authenticate(request);
    const result = await prisma.pushSubscription.deleteMany({ where: { id: String((request.params as { id?: string }).id ?? ""), userId: user.id } });
    return ok(reply, { deleted: result.count > 0 });
  });
}
