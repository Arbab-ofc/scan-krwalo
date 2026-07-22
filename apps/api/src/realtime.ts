import { Server } from "socket.io";
import { Redis } from "ioredis";
import type { FastifyInstance } from "fastify";
import { prisma } from "@scan-krwalo/database";
import { env, corsOrigins } from "./env.js";
import { countOnlineScanners, recordScannerHeartbeat, setScannerOnline } from "./services/presence.service.js";

let realtimeIo: Server | null = null;

export function attachRealtime(app: FastifyInstance) {
  const io = new Server(app.server, { cors: { origin: corsOrigins, credentials: true } });
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  realtimeIo = io;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;
      if (!token) return next(new Error("Authentication required"));
      const decoded = app.jwt.verify<{ sub: string }>(token);
      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user || user.accountStatus === "SUSPENDED") return next(new Error("Forbidden"));
      socket.data.user = user;
      socket.join(`user:${user.id}`);
      socket.join(`role:${user.role.toLowerCase()}`);
      return next();
    } catch (error) {
      return next(error as Error);
    }
  });

  io.on("connection", (socket) => {
    socket.on("presence:heartbeat", async () => {
      const user = socket.data.user;
      if (user?.role !== "SCANNER") return;
      const scanner = await recordScannerHeartbeat(user.id);
      if (!scanner) return;
      await redis.set(`presence:scanner:${scanner.id}`, "online", "EX", 60);
      const onlineScanners = await countOnlineScanners();
      socket.emit("presence:updated", { isOnline: true, onlineScanners });
      emitToRole("CLIENT", "presence:updated", { onlineScanners });
      emitToRole("ADMIN", "presence:updated", { onlineScanners });
    });
    socket.on("presence:offline", async () => {
      const user = socket.data.user;
      if (user?.role !== "SCANNER") return;
      const scanner = await setScannerOnline(user.id, false);
      await redis.del(`presence:scanner:${scanner.id}`);
      const onlineScanners = await countOnlineScanners();
      socket.emit("presence:updated", { isOnline: false, onlineScanners });
      emitToRole("CLIENT", "presence:updated", { onlineScanners });
      emitToRole("ADMIN", "presence:updated", { onlineScanners });
    });
  });

  return { io, redis };
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  realtimeIo?.to(`user:${userId}`).emit(event, payload);
}

export function emitToRole(role: string, event: string, payload: unknown) {
  realtimeIo?.to(`role:${role.toLowerCase()}`).emit(event, payload);
}

export function emitTaskUpdate(taskId: string, event: string, payload: unknown) {
  realtimeIo?.to(`task:${taskId}`).emit(event, payload);
}
