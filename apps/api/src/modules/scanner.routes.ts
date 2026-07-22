import type { FastifyInstance } from "fastify";
import { prisma } from "@scan-krwalo/database";
import { requireRole } from "../authz.js";
import { ok } from "../http.js";
import { liveTasks } from "../services/tasks.service.js";
import { requestPayout, updateScannerProfile } from "../services/payouts.service.js";
import { getPagination, paginated } from "../pagination.js";
import { countOnlineScanners, setScannerOnline } from "../services/presence.service.js";
import { emitToRole } from "../realtime.js";

export async function registerScannerRoutes(app: FastifyInstance) {
  app.get("/dashboard", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const scanner = await prisma.scannerProfile.findUnique({ where: { userId: user.id }, include: { wallet: true } });
    return ok(reply, { scanner, serverTime: new Date().toISOString() });
  });
  app.get("/live-tasks", async (request, reply) => {
    await requireRole(request, ["SCANNER"]);
    const pagination = getPagination(request);
    const result = await liveTasks(pagination);
    return ok(reply, { serverTime: new Date().toISOString(), tasks: result.items, pagination: result.pagination });
  });
  app.get("/current-task", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const scanner = await prisma.scannerProfile.findUnique({ where: { userId: user.id } });
    const task = await prisma.task.findFirst({ where: { assignedScannerId: scanner?.id, status: { in: ["CLAIMED", "SCANNER_SUBMITTED", "DISPUTED"] } } });
    return ok(reply, { serverTime: new Date().toISOString(), task });
  });
  app.get("/history", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const scanner = await prisma.scannerProfile.findUnique({ where: { userId: user.id } });
    const pagination = getPagination(request);
    if (!scanner) return ok(reply, paginated([], 0, pagination));
    const where = { assignedScannerId: scanner.id };
    const [items, total] = await Promise.all([
      prisma.task.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
      prisma.task.count({ where })
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
  app.patch("/profile", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    return ok(reply, await updateScannerProfile(user.id, request.body as never));
  });
  app.post("/presence/online", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const scanner = await setScannerOnline(user.id, true);
    const onlineScanners = await countOnlineScanners();
    emitToRole("CLIENT", "presence:updated", { onlineScanners });
    emitToRole("ADMIN", "presence:updated", { onlineScanners });
    return ok(reply, { scanner, onlineScanners });
  });
  app.post("/presence/offline", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const scanner = await setScannerOnline(user.id, false);
    const onlineScanners = await countOnlineScanners();
    emitToRole("CLIENT", "presence:updated", { onlineScanners });
    emitToRole("ADMIN", "presence:updated", { onlineScanners });
    return ok(reply, { scanner, onlineScanners });
  });
  app.get("/presence/status", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const scanner = await prisma.scannerProfile.findUnique({ where: { userId: user.id } });
    return ok(reply, { isOnline: !!scanner?.isOnline, lastHeartbeatAt: scanner?.lastHeartbeatAt, onlineScanners: await countOnlineScanners() });
  });
  app.get("/wallet", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const scanner = await prisma.scannerProfile.findUnique({ where: { userId: user.id }, include: { wallet: true } });
    return ok(reply, scanner?.wallet);
  });
  app.get("/wallet/transactions", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const scanner = await prisma.scannerProfile.findUnique({ where: { userId: user.id }, include: { wallet: true } });
    const pagination = getPagination(request);
    if (!scanner?.wallet) return ok(reply, paginated([], 0, pagination));
    const where = { walletId: scanner.wallet.id };
    const [items, total] = await Promise.all([
      prisma.scannerWalletTransaction.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
      prisma.scannerWalletTransaction.count({ where })
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
  app.post("/payouts", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    return ok(reply, await requestPayout(user.id, request.body), 201);
  });
  app.get("/payouts", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const scanner = await prisma.scannerProfile.findUnique({ where: { userId: user.id } });
    const pagination = getPagination(request);
    if (!scanner) return ok(reply, paginated([], 0, pagination));
    const where = { scannerId: scanner.id };
    const [items, total] = await Promise.all([
      prisma.payoutRequest.findMany({ where, orderBy: { requestedAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
      prisma.payoutRequest.count({ where })
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
}
