import type { FastifyInstance } from "fastify";
import { prisma } from "@scan-krwalo/database";
import { requireRole } from "../authz.js";
import { ok } from "../http.js";
import { getPagination, paginated } from "../pagination.js";
import { countOnlineScanners } from "../services/presence.service.js";

const clientTaskSelect = {
  id: true,
  publicId: true,
  postedByUserId: true,
  postedByRole: true,
  clientId: true,
  url: true,
  normalizedUrl: true,
  title: true,
  instructions: true,
  status: true,
  publishedAt: true,
  claimExpiresAt: true,
  claimedAt: true,
  completionExpiresAt: true,
  scannerSubmittedAt: true,
  clientConfirmedAt: true,
  completedAt: true,
  expiredAt: true,
  cancelledAt: true,
  assignedScannerId: true,
  createdAt: true,
  updatedAt: true,
  proofs: {
    select: {
      id: true,
      storageKey: true,
      originalFilename: true,
      mimeType: true,
      size: true,
      createdAt: true
    }
  }
} as const;

export async function registerClientRoutes(app: FastifyInstance) {
  app.get("/dashboard", async (request, reply) => {
    const user = await requireRole(request, ["CLIENT"]);
    const client = await prisma.clientProfile.findUnique({ where: { userId: user.id }, include: { creditAccount: true } });
    const tasks = await prisma.task.findMany({ where: { clientId: client?.id }, orderBy: { createdAt: "desc" }, take: 10, select: clientTaskSelect });
    return ok(reply, { client, tasks });
  });
  app.get("/credits", async (request, reply) => {
    const user = await requireRole(request, ["CLIENT"]);
    const client = await prisma.clientProfile.findUnique({ where: { userId: user.id }, include: { creditAccount: true } });
    return ok(reply, client?.creditAccount);
  });
  app.get("/scanner-presence", async (request, reply) => {
    await requireRole(request, ["CLIENT"]);
    return ok(reply, { onlineScanners: await countOnlineScanners(), serverTime: new Date().toISOString() });
  });
  app.get("/credit-transactions", async (request, reply) => {
    const user = await requireRole(request, ["CLIENT"]);
    const client = await prisma.clientProfile.findUnique({ where: { userId: user.id } });
    const pagination = getPagination(request);
    if (!client) return ok(reply, paginated([], 0, pagination));
    const where = { clientId: client.id };
    const [items, total] = await Promise.all([
      prisma.clientCreditTransaction.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
      prisma.clientCreditTransaction.count({ where })
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
  app.get("/tasks", async (request, reply) => {
    const user = await requireRole(request, ["CLIENT"]);
    const client = await prisma.clientProfile.findUnique({ where: { userId: user.id } });
    const pagination = getPagination(request);
    if (!client) return ok(reply, paginated([], 0, pagination));
    const where = { clientId: client.id };
    const [items, total] = await Promise.all([
      prisma.task.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit, select: clientTaskSelect }),
      prisma.task.count({ where })
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
}
