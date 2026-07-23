import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { prisma } from "@scan-krwalo/database";
import { authenticate, requireActivated, requireRole } from "../authz.js";
import { ok } from "../http.js";
import { claimTask, confirmTask, createBulkTasks, createTask, hideClientTaskReward, listTasks, submitTask } from "../services/tasks.service.js";
import { DomainError } from "@scan-krwalo/shared";
import { getPagination } from "../pagination.js";

const allowedProofMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function registerTaskRoutes(app: FastifyInstance) {
  app.post("/", async (request, reply) => {
    const user = await requireActivated(request);
    if (!["CLIENT", "ADMIN"].includes(user.role)) throw new DomainError("FORBIDDEN", "Only clients and admins can post tasks.", 403);
    const task = await createTask(user.id, user.role as "CLIENT" | "ADMIN", request.body);
    return ok(reply, user.role === "CLIENT" ? hideClientTaskReward(task) : task, 201);
  });
  app.post("/bulk", async (request, reply) => {
    const user = await requireActivated(request);
    if (!["CLIENT", "ADMIN"].includes(user.role)) throw new DomainError("FORBIDDEN", "Only clients and admins can post tasks.", 403);
    const tasks = await createBulkTasks(user.id, user.role as "CLIENT" | "ADMIN", request.body);
    return ok(reply, {
      count: tasks.length,
      tasks: user.role === "CLIENT" ? tasks.map(hideClientTaskReward) : tasks
    }, 201);
  });
  app.get("/", async (request, reply) => {
    const user = await authenticate(request);
    const result = await listTasks(user.id, user.role, getPagination(request));
    return ok(reply, { serverTime: new Date().toISOString(), tasks: result.items, pagination: result.pagination });
  });
  app.get("/proofs/:key", async (request, reply) => {
    const user = await authenticate(request);
    const params = request.params as { key: string };
    const proof = await prisma.taskProof.findFirst({
      where: { storageKey: params.key },
      include: { task: { include: { client: true, assignedScanner: true } } }
    });
    if (!proof) throw new DomainError("TASK_INVALID_STATE", "Proof not found.", 404);
    const allowed =
      user.role === "ADMIN" ||
      proof.uploadedByUserId === user.id ||
      proof.task.client?.userId === user.id ||
      proof.task.assignedScanner?.userId === user.id;
    if (!allowed) throw new DomainError("FORBIDDEN", "You cannot view this proof.", 403);
    return reply.type(proof.mimeType).send(createReadStream(join(process.cwd(), "uploads", "task-proofs", proof.storageKey)));
  });
  app.get("/:id", async (request, reply) => {
    const user = await authenticate(request);
    const params = request.params as { id: string };
    const task = await prisma.task.findUnique({ where: { id: params.id }, include: { client: true, proofs: true } });
    if (user.role === "CLIENT" && task?.client?.userId === user.id) {
      const { client: _client, ...taskWithoutClient } = task;
      const clientTask = hideClientTaskReward(taskWithoutClient);
      return ok(reply, clientTask);
    }
    return ok(reply, task);
  });
  app.post("/:id/claim", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const params = request.params as { id: string };
    return ok(reply, await claimTask(user.id, params.id));
  });
  app.post("/:id/submit", async (request, reply) => {
    const user = await requireRole(request, ["SCANNER"]);
    const params = request.params as { id: string };
    if (!request.isMultipart()) {
      return ok(reply, await submitTask(user.id, params.id, request.body));
    }
    const file = await request.file();
    if (!file) throw new DomainError("TASK_INVALID_STATE", "Proof file is required.", 400);
    if (!allowedProofMimeTypes.has(file.mimetype)) throw new DomainError("TASK_INVALID_STATE", "Proof must be an image or PDF.", 400);
    const buffer = await file.toBuffer();
    const extension = safeExtension(file.filename, file.mimetype);
    const storageKey = `proof-${params.id}-${randomUUID()}${extension}`;
    const uploadDir = join(process.cwd(), "uploads", "task-proofs");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, storageKey), buffer);
    const checksum = createHash("sha256").update(buffer).digest("hex");
    return ok(reply, await submitTask(user.id, params.id, {}, {
      storageKey,
      originalFilename: file.filename,
      mimeType: file.mimetype,
      size: buffer.length,
      checksum
    }));
  });
  app.post("/:id/confirm", async (request, reply) => {
    const user = await requireRole(request, ["CLIENT"]);
    const params = request.params as { id: string };
    return ok(reply, hideClientTaskReward(await confirmTask(user.id, params.id)));
  });
  app.post("/:id/dispute", async (_, reply) => ok(reply, { created: true }));
  app.post("/:id/cancel", async (_, reply) => ok(reply, { cancelled: true }));
}

function safeExtension(filename: string | undefined, mimeType: string) {
  const current = extname(filename ?? "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".pdf"].includes(current)) return current;
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "application/pdf") return ".pdf";
  return ".jpg";
}
