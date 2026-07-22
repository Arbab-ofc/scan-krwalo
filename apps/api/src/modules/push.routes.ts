import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@scan-krwalo/database";
import { authenticate } from "../authz.js";
import { ok } from "../http.js";
import { getPushConfig } from "../services/push.service.js";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

export async function registerPushRoutes(app: FastifyInstance) {
  app.get("/public-key", async (_, reply) => ok(reply, getPushConfig()));

  app.post("/", async (request, reply) => {
    const user = await authenticate(request);
    const data = pushSubscriptionSchema.parse(request.body);
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      update: { userId: user.id, keys: data.keys },
      create: { userId: user.id, endpoint: data.endpoint, keys: data.keys }
    });
    return ok(reply, { id: subscription.id }, 201);
  });

  app.delete("/:id", async (request, reply) => {
    const user = await authenticate(request);
    const params = request.params as { id: string };
    await prisma.pushSubscription.deleteMany({ where: { id: params.id, userId: user.id } });
    return ok(reply, { deleted: true });
  });
}
