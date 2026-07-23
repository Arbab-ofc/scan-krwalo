import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Prisma, prisma } from "@scan-krwalo/database";
import {
  assertTaskTransition,
  displayToMinorUnits,
  DomainError,
  normalizeTaskUrl,
  taskBulkCreateSchema,
  taskCreateSchema,
  submitTaskSchema
} from "@scan-krwalo/shared";
import { getSettings } from "./settings.service.js";
import { notifyEligibleOnlineScannersForTask } from "./notification.service.js";
import { paginated, type Pagination } from "../pagination.js";
import { scheduleClaimExpiry, scheduleClientReviewExpiry, scheduleCompletionExpiry } from "../queues.js";
import { emitToRole, emitToUser } from "../realtime.js";
import { isScannerRecentlyOnline } from "./presence.service.js";

type StoredTaskProof = {
  storageKey: string;
  originalFilename?: string;
  mimeType: string;
  size: number;
  checksum?: string;
};

function publicId() {
  return `TASK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function hideClientTaskReward<T extends { rewardAmount?: unknown; rewardCurrency?: unknown; rewardSource?: unknown; rewardConfiguredAt?: unknown }>(task: T) {
  const { rewardAmount: _rewardAmount, rewardCurrency: _rewardCurrency, rewardSource: _rewardSource, rewardConfiguredAt: _rewardConfiguredAt, ...clientTask } = task;
  return clientTask;
}

async function reserveClientCredit(tx: Prisma.TransactionClient, clientId: string, taskId: string, actorUserId: string) {
  const account = await tx.clientCreditAccount.findUnique({ where: { clientId } });
  if (!account || account.availableCredits < 1) throw new DomainError("CLIENT_NO_TASK_CREDITS", "No task credits available.", 409);
  await tx.clientCreditTransaction.create({
    data: {
      accountId: account.id,
      clientId,
      type: "TASK_RESERVATION",
      direction: "DEBIT",
      amount: 1,
      availableBefore: account.availableCredits,
      availableAfter: account.availableCredits - 1,
      reservedBefore: account.reservedCredits,
      reservedAfter: account.reservedCredits + 1,
      usedBefore: account.usedCredits,
      usedAfter: account.usedCredits,
      referenceType: "Task",
      referenceId: taskId,
      idempotencyKey: `task:${taskId}:credit:reserve`,
      description: "Task credit reserved",
      createdByUserId: actorUserId
    }
  });
  await tx.clientCreditAccount.update({
    where: { id: account.id },
    data: { availableCredits: { decrement: 1 }, reservedCredits: { increment: 1 } }
  });
  await tx.clientProfile.update({
    where: { id: clientId },
    data: { availableTaskCredits: { decrement: 1 }, reservedTaskCredits: { increment: 1 }, totalPostedTasks: { increment: 1 } }
  });
}

function normalizeTaskInput(url: string, blockedDomains: string[]) {
  try {
    return normalizeTaskUrl(url, blockedDomains);
  } catch {
    throw new DomainError("TASK_INVALID_URL", "Task URL is invalid or blocked.", 400);
  }
}

async function publishTaskNotifications(task: { id: string; publicId: string }, claimExpiresAt: Date) {
  await notifyEligibleOnlineScannersForTask(task.id);
  await scheduleClaimExpiry(task.id, Math.max(0, claimExpiresAt.getTime() - Date.now()));
  emitToRole("SCANNER", "task:available", { taskId: task.id, publicId: task.publicId });
  emitToRole("SCANNER", "notification:new", { type: "TASK_AVAILABLE", taskId: task.id });
}

async function createAvailableTask(tx: Prisma.TransactionClient, input: {
  actorUserId: string;
  actorRole: "CLIENT" | "ADMIN";
  clientId?: string;
  url: string;
  normalizedUrl: string;
  urlHash: string;
  title?: string;
  instructions?: string;
  rewardAmount: bigint;
  rewardCurrency: string;
  rewardSource: "DEFAULT" | "ADMIN_CUSTOM";
  now: Date;
  claimExpiresAt: Date;
  taskClaimWindowSeconds: number;
  taskCompletionWindowSeconds: number;
  clientReviewWindowSeconds: number;
}) {
  const task = await tx.task.create({
    data: {
      publicId: publicId(),
      postedByUserId: input.actorUserId,
      postedByRole: input.actorRole,
      clientId: input.clientId,
      url: input.url,
      normalizedUrl: input.normalizedUrl,
      urlHash: input.urlHash,
      title: input.title,
      instructions: input.instructions,
      status: "AVAILABLE",
      rewardAmount: input.rewardAmount,
      rewardCurrency: input.rewardCurrency,
      rewardSource: input.rewardSource,
      rewardConfiguredAt: input.now,
      claimWindowSeconds: input.taskClaimWindowSeconds,
      completionWindowSeconds: input.taskCompletionWindowSeconds,
      clientReviewWindowSeconds: input.clientReviewWindowSeconds,
      publishedAt: input.now,
      claimExpiresAt: input.claimExpiresAt
    }
  });
  if (input.clientId) await reserveClientCredit(tx, input.clientId, task.id, input.actorUserId);
  await tx.taskEvent.create({
    data: {
      taskId: task.id,
      eventType: "TASK_CREATED",
      previousStatus: "DRAFT",
      newStatus: "AVAILABLE",
      actorUserId: input.actorUserId,
      actorRole: input.actorRole === "ADMIN" ? "ADMIN" : "CLIENT"
    }
  });
  await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "TASK_CREATED", entityType: "Task", entityId: task.id } });
  return task;
}

export async function createTask(actorUserId: string, actorRole: "CLIENT" | "ADMIN", input: unknown) {
  const data = taskCreateSchema.parse(input);
  const settings = await getSettings();
  const normalized = normalizeTaskInput(data.url, settings.blockedDomains);
  const rewardAmount = actorRole === "ADMIN" && data.customRewardAmount
    ? displayToMinorUnits(data.customRewardAmount)
    : BigInt(settings.defaultScannerReward);
  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + settings.taskClaimWindowSeconds * 1000);
  const result = await prisma.$transaction(async (tx) => {
    const client = actorRole === "CLIENT"
      ? await tx.clientProfile.findUnique({ where: { userId: actorUserId } })
      : null;
    if (actorRole === "CLIENT" && (!client || client.status !== "ACTIVE")) {
      throw new DomainError("FORBIDDEN", "Client profile is not active.", 403);
    }
    return createAvailableTask(tx, {
      actorUserId,
      actorRole,
      clientId: client?.id,
      url: data.url,
      normalizedUrl: normalized.normalizedUrl,
      urlHash: normalized.urlHash,
      title: data.title,
      instructions: data.instructions,
      rewardAmount,
      rewardCurrency: settings.rewardCurrency,
      rewardSource: actorRole === "ADMIN" && data.customRewardAmount ? "ADMIN_CUSTOM" : "DEFAULT",
      now,
      claimExpiresAt,
      taskClaimWindowSeconds: settings.taskClaimWindowSeconds,
      taskCompletionWindowSeconds: settings.taskCompletionWindowSeconds,
      clientReviewWindowSeconds: settings.clientReviewWindowSeconds
    });
  });
  await publishTaskNotifications(result, claimExpiresAt);
  return result;
}

export async function createBulkTasks(actorUserId: string, actorRole: "CLIENT" | "ADMIN", input: unknown) {
  const data = taskBulkCreateSchema.parse(input);
  const settings = await getSettings();
  const normalizedUrls = data.urls.map((url) => ({ url, normalized: normalizeTaskInput(url, settings.blockedDomains) }));
  const rewardAmount = BigInt(settings.defaultScannerReward);
  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + settings.taskClaimWindowSeconds * 1000);
  const tasks = await prisma.$transaction(async (tx) => {
    const client = actorRole === "CLIENT"
      ? await tx.clientProfile.findUnique({ where: { userId: actorUserId }, include: { creditAccount: true } })
      : null;
    if (actorRole === "CLIENT" && (!client || client.status !== "ACTIVE")) {
      throw new DomainError("FORBIDDEN", "Client profile is not active.", 403);
    }
    if (client && (!client.creditAccount || client.creditAccount.availableCredits < normalizedUrls.length)) {
      throw new DomainError("CLIENT_NO_TASK_CREDITS", `You need ${normalizedUrls.length} available task credits.`, 409);
    }
    const created = [];
    for (const item of normalizedUrls) {
      created.push(await createAvailableTask(tx, {
        actorUserId,
        actorRole,
        clientId: client?.id,
        url: item.url,
        normalizedUrl: item.normalized.normalizedUrl,
        urlHash: item.normalized.urlHash,
        rewardAmount,
        rewardCurrency: settings.rewardCurrency,
        rewardSource: "DEFAULT",
        now,
        claimExpiresAt,
        taskClaimWindowSeconds: settings.taskClaimWindowSeconds,
        taskCompletionWindowSeconds: settings.taskCompletionWindowSeconds,
        clientReviewWindowSeconds: settings.clientReviewWindowSeconds
      }));
    }
    return created;
  }, { maxWait: 10_000, timeout: 30_000 });
  for (const task of tasks) {
    await publishTaskNotifications(task, claimExpiresAt);
  }
  return tasks;
}

export async function claimTask(userId: string, taskId: string) {
  const scanner = await prisma.scannerProfile.findUnique({ where: { userId } });
  if (!scanner || scanner.status !== "ACTIVE") throw new DomainError("FORBIDDEN", "Scanner profile is not active.", 403);
  if (!isScannerRecentlyOnline(scanner)) throw new DomainError("SCANNER_OFFLINE", "Go online before grabbing tasks.", 409);
  const claimed = await prisma.$transaction(async (tx) => {
    const active = await tx.task.findFirst({
      where: { assignedScannerId: scanner.id, status: { in: ["CLAIMED", "SCANNER_SUBMITTED", "DISPUTED"] } },
      select: { id: true }
    });
    if (active) throw new DomainError("SCANNER_ALREADY_HAS_ACTIVE_TASK", "You already have an active task.", 409);
    const now = new Date();
    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (!task) throw new DomainError("TASK_ALREADY_CLAIMED", "This task is no longer available.", 409);
    if (task.status !== "AVAILABLE") throw new DomainError("TASK_ALREADY_CLAIMED", "This task has already been grabbed by another Scanner.", 409);
    if (!task.claimExpiresAt || task.claimExpiresAt <= now) throw new DomainError("TASK_CLAIM_WINDOW_EXPIRED", "Task claim window has expired.", 409);
    const completionExpiresAt = new Date(now.getTime() + task.completionWindowSeconds * 1000);
    const update = await tx.task.updateMany({
      where: { id: taskId, status: "AVAILABLE", claimExpiresAt: { gt: now } },
      data: {
        status: "CLAIMED",
        assignedScannerId: scanner.id,
        claimedAt: now,
        completionExpiresAt,
        version: { increment: 1 }
      }
    });
    if (update.count !== 1) throw new DomainError("TASK_ALREADY_CLAIMED", "This task has already been grabbed by another Scanner.", 409);
    await tx.taskClaim.create({ data: { taskId, scannerId: scanner.id, status: "CLAIMED", claimedAt: now } });
    await tx.scannerProfile.update({ where: { id: scanner.id }, data: { lastTaskClaimedAt: now } });
    await tx.taskEvent.create({ data: { taskId, eventType: "TASK_CLAIMED", previousStatus: "AVAILABLE", newStatus: "CLAIMED", actorUserId: userId, actorRole: "SCANNER" } });
    await tx.auditLog.create({ data: { actorUserId: userId, action: "TASK_CLAIMED", entityType: "Task", entityId: taskId } });
    return tx.task.findUniqueOrThrow({ where: { id: taskId } });
  });
  if (claimed.completionExpiresAt) {
    await scheduleCompletionExpiry(claimed.id, Math.max(0, claimed.completionExpiresAt.getTime() - Date.now()));
  }
  emitToRole("SCANNER", "task:claimed", { taskId: claimed.id, publicId: claimed.publicId });
  emitToRole("SCANNER", "task:removed", { taskId: claimed.id, publicId: claimed.publicId });
  emitToUser(userId, "task:updated", { taskId: claimed.id, status: claimed.status });
  return claimed;
}

export async function submitTask(userId: string, taskId: string, input: unknown, proof?: StoredTaskProof) {
  const data = submitTaskSchema.parse(input);
  const scanner = await prisma.scannerProfile.findUnique({ where: { userId } });
  if (!scanner) throw new DomainError("FORBIDDEN", "Scanner profile required.", 403);
  const updated = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (!task || task.assignedScannerId !== scanner.id) throw new DomainError("TASK_NOT_OWNED", "Task is not assigned to this scanner.", 403);
    if (task.status !== "CLAIMED") throw new DomainError("TASK_INVALID_STATE", "Task is not ready for scanner submission.", 409);
    if (!task.completionExpiresAt || task.completionExpiresAt <= new Date()) throw new DomainError("TASK_COMPLETION_WINDOW_EXPIRED", "Completion window has expired.", 409);
    assertTaskTransition(task.status, "SCANNER_SUBMITTED");
    await tx.taskSubmission.create({
      data: {
        taskId,
        scannerId: scanner.id,
        note: data.note,
        idempotencyKey: `task:${taskId}:scanner:${scanner.id}:submit`
      }
    });
    if (proof) {
      await tx.taskProof.create({
        data: {
          taskId,
          uploadedByUserId: userId,
          storageKey: proof.storageKey,
          originalFilename: proof.originalFilename,
          mimeType: proof.mimeType,
          size: proof.size,
          checksum: proof.checksum
        }
      });
    }
    const updated = await tx.task.update({
      where: { id: taskId },
      data: { status: "SCANNER_SUBMITTED", scannerSubmittedAt: new Date(), version: { increment: 1 } }
    });
    await tx.taskEvent.create({ data: { taskId, eventType: "TASK_SUBMITTED", previousStatus: "CLAIMED", newStatus: "SCANNER_SUBMITTED", actorUserId: userId, actorRole: "SCANNER" } });
    if (task.clientId) {
      const client = await tx.clientProfile.findUnique({ where: { id: task.clientId } });
      if (client) await tx.notification.create({ data: { userId: client.userId, type: "TASK_SUBMITTED", title: "Task submitted", message: `${task.publicId} is ready for review.`, payload: { taskId } } });
    }
    return updated;
  });
  if (updated.clientReviewWindowSeconds) {
    await scheduleClientReviewExpiry(updated.id, updated.clientReviewWindowSeconds * 1000);
  }
  const client = updated.clientId ? await prisma.clientProfile.findUnique({ where: { id: updated.clientId }, select: { userId: true } }) : null;
  if (client) {
    emitToUser(client.userId, "task:submitted", { taskId: updated.id, publicId: updated.publicId });
    emitToUser(client.userId, "notification:new", { type: "TASK_SUBMITTED", taskId: updated.id });
  }
  emitToUser(userId, "task:updated", { taskId: updated.id, status: updated.status });
  return updated;
}

async function settleCompletedTask(tx: Prisma.TransactionClient, taskId: string, actorUserId: string, automated = false) {
  const task = await tx.task.findUnique({ where: { id: taskId }, include: { assignedScanner: { include: { wallet: true } }, client: { include: { creditAccount: true } } } });
  if (!task || !task.assignedScanner || !task.assignedScanner.wallet) throw new DomainError("TASK_INVALID_STATE", "Task cannot be settled.", 409);
  if (!["SCANNER_SUBMITTED", "CLIENT_CONFIRMED", "DISPUTED", "AUTO_COMPLETED"].includes(task.status)) {
    if (task.status === "COMPLETED") return task;
    throw new DomainError("TASK_INVALID_STATE", "Task cannot be confirmed now.", 409);
  }
  const wallet = task.assignedScanner.wallet;
  let rewardLedgerCreated = true;
  try {
    await tx.scannerWalletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "TASK_REWARD",
        direction: "CREDIT",
        amount: task.rewardAmount,
        currency: task.rewardCurrency,
        availableBefore: wallet.availableBalance,
        availableAfter: wallet.availableBalance + task.rewardAmount,
        pendingBefore: wallet.pendingBalance,
        pendingAfter: wallet.pendingBalance,
        reservedBefore: wallet.reservedForPayout,
        reservedAfter: wallet.reservedForPayout,
        referenceType: "Task",
        referenceId: task.id,
        idempotencyKey: `task:${task.id}:reward`,
        description: "Task reward credited",
        createdByUserId: actorUserId
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") rewardLedgerCreated = false;
    else throw error;
  }
  if (rewardLedgerCreated) {
    await tx.scannerWallet.update({
      where: { id: wallet.id },
      data: { availableBalance: { increment: task.rewardAmount }, lifetimeEarnings: { increment: task.rewardAmount } }
    });
    await tx.scannerProfile.update({
      where: { id: task.assignedScanner.id },
      data: { availableBalance: { increment: task.rewardAmount }, lifetimeEarnings: { increment: task.rewardAmount }, completedTaskCount: { increment: 1 } }
    });
  }
  if (task.client?.creditAccount) {
    const account = task.client.creditAccount;
    let creditLedgerCreated = true;
    try {
      await tx.clientCreditTransaction.create({
        data: {
          accountId: account.id,
          clientId: task.client.id,
          type: "TASK_COMPLETION",
          direction: "DEBIT",
          amount: 1,
          availableBefore: account.availableCredits,
          availableAfter: account.availableCredits,
          reservedBefore: account.reservedCredits,
          reservedAfter: account.reservedCredits - 1,
          usedBefore: account.usedCredits,
          usedAfter: account.usedCredits + 1,
          referenceType: "Task",
          referenceId: task.id,
          idempotencyKey: `task:${task.id}:credit:complete`,
          description: "Reserved task credit consumed",
          createdByUserId: actorUserId
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") creditLedgerCreated = false;
      else throw error;
    }
    if (creditLedgerCreated) {
      await tx.clientCreditAccount.update({ where: { id: account.id }, data: { reservedCredits: { decrement: 1 }, usedCredits: { increment: 1 } } });
      await tx.clientProfile.update({ where: { id: task.client.id }, data: { reservedTaskCredits: { decrement: 1 }, usedTaskCredits: { increment: 1 }, completedTasks: { increment: 1 } } });
    }
  }
  const proofFiles = await tx.taskProof.findMany({ where: { taskId: task.id }, select: { storageKey: true } });
  if (proofFiles.length > 0) await tx.taskProof.deleteMany({ where: { taskId: task.id } });
  const finalStatus = automated ? "AUTO_COMPLETED" : "COMPLETED";
  const updated = await tx.task.update({
    where: { id: task.id },
    data: { status: finalStatus, clientConfirmedAt: new Date(), completedAt: new Date(), version: { increment: 1 } }
  });
  await tx.taskEvent.create({ data: { taskId: task.id, eventType: automated ? "TASK_AUTO_COMPLETED" : "TASK_CONFIRMED", previousStatus: task.status, newStatus: finalStatus, actorUserId, actorRole: automated ? undefined : "CLIENT" } });
  await deleteProofFiles(proofFiles.map((proof) => proof.storageKey));
  return updated;
}

export async function confirmTask(userId: string, taskId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId }, include: { client: true } });
    if (!task?.client || task.client.userId !== userId) throw new DomainError("TASK_NOT_OWNED", "Task is not owned by this client.", 403);
    if (task.status === "COMPLETED" || task.status === "AUTO_COMPLETED") return task;
    if (task.status !== "SCANNER_SUBMITTED") throw new DomainError("TASK_INVALID_STATE", "Task cannot be confirmed now.", 409);
    const update = await tx.task.updateMany({ where: { id: taskId, status: "SCANNER_SUBMITTED" }, data: { status: "CLIENT_CONFIRMED", clientConfirmedAt: new Date() } });
    if (update.count !== 1) {
      const latest = await tx.task.findUnique({ where: { id: taskId } });
      if (latest?.status === "COMPLETED" || latest?.status === "AUTO_COMPLETED") return latest;
      throw new DomainError("TASK_INVALID_STATE", "Task cannot be confirmed now.", 409);
    }
    return settleCompletedTask(tx, taskId, userId);
  }, { maxWait: 10_000, timeout: 20_000 });
  const scannerUser = updated.assignedScannerId
    ? await prisma.scannerProfile.findUnique({ where: { id: updated.assignedScannerId }, select: { userId: true } })
    : null;
  emitToUser(userId, "task:confirmed", { taskId: updated.id, status: updated.status });
  emitToUser(userId, "credits:updated", { taskId: updated.id });
  if (scannerUser) {
    emitToUser(scannerUser.userId, "task:confirmed", { taskId: updated.id, status: updated.status });
    emitToUser(scannerUser.userId, "wallet:updated", { taskId: updated.id });
  }
  emitToRole("ADMIN", "task:updated", { taskId: updated.id, status: updated.status });
  return updated;
}

export async function autoCompleteReview(taskId: string) {
  const updated = await prisma.$transaction((tx) => settleCompletedTask(tx, taskId, "system", true));
  if (updated.clientId) {
    const client = await prisma.clientProfile.findUnique({ where: { id: updated.clientId }, select: { userId: true } });
    if (client) emitToUser(client.userId, "credits:updated", { taskId: updated.id });
  }
  if (updated.assignedScannerId) {
    const scanner = await prisma.scannerProfile.findUnique({ where: { id: updated.assignedScannerId }, select: { userId: true } });
    if (scanner) emitToUser(scanner.userId, "wallet:updated", { taskId: updated.id });
  }
  emitToRole("ADMIN", "task:updated", { taskId: updated.id, status: updated.status });
  return updated;
}

export async function listTasks(userId: string, role: string, pagination: Pagination) {
  if (role === "ADMIN") {
    const [items, total] = await Promise.all([
      prisma.task.findMany({ orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
      prisma.task.count()
    ]);
    return paginated(items, total, pagination);
  }
  if (role === "SCANNER") {
    const scanner = await prisma.scannerProfile.findUnique({ where: { userId } });
    if (!scanner) return paginated([], 0, pagination);
    const where = { assignedScannerId: scanner.id };
    const [items, total] = await Promise.all([
      prisma.task.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
      prisma.task.count({ where })
    ]);
    return paginated(items, total, pagination);
  }
  const client = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!client) return paginated([], 0, pagination);
  const where = { clientId: client.id };
  const [items, total] = await Promise.all([
    prisma.task.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
    prisma.task.count({ where })
  ]);
  return paginated(items.map(hideClientTaskReward), total, pagination);
}

export async function liveTasks(pagination: Pagination) {
  await expireDueUnclaimedTasks();
  const where = { status: "AVAILABLE" as const, claimExpiresAt: { gt: new Date() } };
  const [items, total] = await Promise.all([
    prisma.task.findMany({ where, orderBy: { publishedAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
    prisma.task.count({ where })
  ]);
  return paginated(items, total, pagination);
}

export async function expireUnclaimedTask(taskId: string) {
  const expired = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId }, include: { client: { include: { creditAccount: true } } } });
    if (!task || task.status !== "AVAILABLE" || !task.claimExpiresAt || task.claimExpiresAt > new Date()) return null;
    const updated = await tx.task.update({
      where: { id: task.id },
      data: { status: "CLAIM_EXPIRED", expiredAt: new Date(), version: { increment: 1 } }
    });
    await tx.taskEvent.create({ data: { taskId, eventType: "TASK_EXPIRED", previousStatus: "AVAILABLE", newStatus: "CLAIM_EXPIRED" } });
    if (task.client?.creditAccount) {
      const account = task.client.creditAccount;
      let ledgerCreated = true;
      try {
        await tx.clientCreditTransaction.create({
          data: {
            accountId: account.id,
            clientId: task.client.id,
            type: "TASK_REFUND",
            direction: "CREDIT",
            amount: 1,
            availableBefore: account.availableCredits,
            availableAfter: account.availableCredits + 1,
            reservedBefore: account.reservedCredits,
            reservedAfter: Math.max(0, account.reservedCredits - 1),
            usedBefore: account.usedCredits,
            usedAfter: account.usedCredits,
            referenceType: "Task",
            referenceId: task.id,
            idempotencyKey: `task:${task.id}:credit:claim-expiry-refund`,
            description: "Reserved credit returned because no scanner grabbed the task"
          }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ledgerCreated = false;
        else throw error;
      }
      if (ledgerCreated) {
        await tx.clientCreditAccount.update({ where: { id: account.id }, data: { availableCredits: { increment: 1 }, reservedCredits: { decrement: 1 } } });
        await tx.clientProfile.update({ where: { id: task.client.id }, data: { availableTaskCredits: { increment: 1 }, reservedTaskCredits: { decrement: 1 } } });
      }
    }
    return updated;
  }, { maxWait: 10_000, timeout: 20_000 });
  if (expired) {
    emitToRole("SCANNER", "task:expired", { taskId: expired.id, publicId: expired.publicId });
    emitToRole("SCANNER", "task:removed", { taskId: expired.id, publicId: expired.publicId });
    if (expired.clientId) {
      const client = await prisma.clientProfile.findUnique({ where: { id: expired.clientId }, select: { userId: true } });
      if (client) emitToUser(client.userId, "credits:updated", { taskId: expired.id });
    }
    emitToRole("ADMIN", "task:updated", { taskId: expired.id, status: expired.status });
  }
  return expired;
}

export async function expireDueUnclaimedTasks() {
  const dueTasks = await prisma.task.findMany({
    where: { status: "AVAILABLE", claimExpiresAt: { lte: new Date() } },
    select: { id: true },
    take: 25
  });
  await Promise.all(dueTasks.map((task) => expireUnclaimedTask(task.id)));
}

async function deleteProofFiles(storageKeys: string[]) {
  await Promise.all(storageKeys.map(async (storageKey) => {
    try {
      await unlink(join(process.cwd(), "uploads", "task-proofs", storageKey));
    } catch {
      // The database record is the source of visibility; missing local files should not break settlement.
    }
  }));
}
