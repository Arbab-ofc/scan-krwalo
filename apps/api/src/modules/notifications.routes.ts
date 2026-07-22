import type { FastifyInstance } from "fastify";
import { prisma } from "@scan-krwalo/database";
import { authenticate } from "../authz.js";
import { ok } from "../http.js";
import { getPagination, paginated } from "../pagination.js";

export async function registerNotificationRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const user = await authenticate(request);
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
      prisma.notification.count({ where: { userId: user.id } })
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
  app.get("/unread-count", async (request, reply) => {
    const user = await authenticate(request);
    return ok(reply, { count: await prisma.notification.count({ where: { userId: user.id, readAt: null } }) });
  });
  app.post("/:id/read", async (request, reply) => {
    const user = await authenticate(request);
    const params = request.params as { id: string };
    return ok(reply, await prisma.notification.updateMany({ where: { id: params.id, userId: user.id }, data: { readAt: new Date() } }));
  });
  app.post("/read-all", async (request, reply) => {
    const user = await authenticate(request);
    return ok(reply, await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } }));
  });
}
