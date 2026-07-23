import type { FastifyInstance } from "fastify";
import { authenticate } from "../authz.js";
import { ok } from "../http.js";
import { getPushConfig, sendPushNotificationNow } from "../services/push.service.js";

export async function registerPushRoutes(app: FastifyInstance) {
  app.get("/public-key", async (_, reply) => ok(reply, getPushConfig()));

  app.post("/", async (request, reply) => {
    const user = await authenticate(request);
    return ok(reply, { provider: "onesignal", externalId: user.id }, 201);
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
    await authenticate(request);
    return ok(reply, { deleted: true });
  });
}
