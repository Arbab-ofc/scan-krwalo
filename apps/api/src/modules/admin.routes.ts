import type { FastifyInstance } from "fastify";
import { Prisma, prisma } from "@scan-krwalo/database";
import { requireRole } from "../authz.js";
import { ok } from "../http.js";
import { createActivationCode, getActivationCode, listActivationCodes } from "../services/activation.service.js";
import { transitionPayout } from "../services/payouts.service.js";
import { getPagination, paginated } from "../pagination.js";
import { DomainError, minorUnitsToDisplay } from "@scan-krwalo/shared";

type AdminTaskQuery = {
  status?: string;
  postedByRole?: string;
  search?: string;
};

type ReportName = "daily-completed" | "scanner-earnings" | "client-credit-usage" | "failed-expired" | "users" | "payouts" | "wallets" | "credits";

type ReportQuery = {
  startDate?: string;
  endDate?: string;
};

const adminTaskInclude = {
  client: {
    include: {
      user: { select: { username: true, email: true, accountStatus: true } },
      creditAccount: true
    }
  },
  assignedScanner: {
    include: {
      user: { select: { username: true, email: true, accountStatus: true } },
      wallet: true
    }
  },
  proofs: {
    select: {
      id: true,
      storageKey: true,
      originalFilename: true,
      mimeType: true,
      size: true,
      createdAt: true
    }
  },
  dispute: true
} satisfies Prisma.TaskInclude;

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/dashboard", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const [users, tasks, payouts] = await Promise.all([prisma.user.count(), prisma.task.count(), prisma.payoutRequest.count({ where: { status: "REQUESTED" } })]);
    return ok(reply, { users, tasks, requestedPayouts: payouts });
  });
  app.post("/activation-codes/scanner", async (request, reply) => {
    const user = await requireRole(request, ["ADMIN"]);
    return ok(reply, await createActivationCode({ type: "SCANNER", adminId: user.id, ...(request.body as object) }), 201);
  });
  app.post("/activation-codes/client", async (request, reply) => {
    const user = await requireRole(request, ["ADMIN"]);
    const body = request.body as { initialTaskCredits: number; recordedPrice?: string; expiresAt?: string };
    return ok(reply, await createActivationCode({ type: "CLIENT", adminId: user.id, ...body }), 201);
  });
  app.get("/activation-codes", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    return ok(reply, await listActivationCodes(getPagination(request)));
  });
  app.get("/activation-codes/:id", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const params = request.params as { id: string };
    return ok(reply, await getActivationCode(params.id));
  });
  app.post("/activation-codes/:id/revoke", async (request, reply) => {
    const user = await requireRole(request, ["ADMIN"]);
    const params = request.params as { id: string };
    const body = request.body as { reason?: string };
    await prisma.activationCode.update({ where: { id: params.id }, data: { status: "REVOKED", revokedAt: new Date(), revokedByAdminId: user.id, revocationReason: body.reason } });
    return ok(reply, await getActivationCode(params.id));
  });
  app.delete("/activation-codes/:id", async (request, reply) => {
    const user = await requireRole(request, ["ADMIN"]);
    const params = request.params as { id: string };
    const code = await prisma.activationCode.findUnique({ where: { id: params.id } });
    if (!code) throw new DomainError("FORBIDDEN", "Activation code not found.", 404);
    if (code.status !== "REVOKED") {
      throw new DomainError("FORBIDDEN", "Only revoked activation codes can be deleted.", 409);
    }
    await prisma.$transaction(async (tx) => {
      await tx.activationCode.delete({ where: { id: code.id } });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "CODE_DELETED",
          entityType: "ActivationCode",
          entityId: code.id,
          beforeData: { codePreview: code.codePreview, codeType: code.codeType, status: code.status }
        }
      });
    });
    return ok(reply, { deleted: true, id: code.id });
  });
  app.get("/scanners", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.scannerProfile.findMany({
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { username: true, email: true, accountStatus: true } }, wallet: true }
      }),
      prisma.scannerProfile.count()
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
  app.get("/clients", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.clientProfile.findMany({
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { username: true, email: true, accountStatus: true } }, creditAccount: true }
      }),
      prisma.clientProfile.count()
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
  app.patch("/users/:id/status", async (request, reply) => {
    const admin = await requireRole(request, ["ADMIN"]);
    const params = request.params as { id: string };
    const body = request.body as { accountStatus: "ACTIVE" | "SUSPENDED" };
    const user = await prisma.user.update({ where: { id: params.id }, data: { accountStatus: body.accountStatus, suspendedAt: body.accountStatus === "SUSPENDED" ? new Date() : null } });
    await prisma.auditLog.create({ data: { actorUserId: admin.id, action: body.accountStatus === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED", entityType: "User", entityId: user.id } });
    return ok(reply, user);
  });
  app.get("/tasks/export.csv", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const query = request.query as AdminTaskQuery;
    const where = buildAdminTaskWhere(query);
    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: adminTaskInclude
    });
    const csv = toCsv(tasks.map(taskReportRow));
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="scan-krwalo-task-report-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  });
  app.get("/tasks/:id", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const params = request.params as { id: string };
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        ...adminTaskInclude,
        events: { orderBy: { createdAt: "asc" } },
        claims: { orderBy: { claimedAt: "asc" }, include: { scanner: { include: { user: { select: { username: true, email: true } } } } } },
        submissions: { orderBy: { submittedAt: "desc" } }
      }
    });
    if (!task) throw new DomainError("TASK_INVALID_STATE", "Task not found.", 404);
    const [creditLedger, walletLedger] = await Promise.all([
      task.clientId
        ? prisma.clientCreditTransaction.findMany({
            where: { OR: [{ referenceId: task.id }, { clientId: task.clientId }] },
            orderBy: { createdAt: "desc" },
            take: 50
          })
        : [],
      task.assignedScanner?.wallet
        ? prisma.scannerWalletTransaction.findMany({
            where: { OR: [{ referenceId: task.id }, { walletId: task.assignedScanner.wallet.id }] },
            orderBy: { createdAt: "desc" },
            take: 50
          })
        : []
    ]);
    return ok(reply, {
      task: {
        ...taskReportRow(task),
        instructions: task.instructions,
        raw: task,
        proofs: task.proofs.map((proof) => ({ ...proof, viewUrl: `/api/v1/tasks/proofs/${proof.storageKey}` })),
        events: task.events,
        claims: task.claims,
        submissions: task.submissions,
        dispute: task.dispute,
        client: task.client,
        scanner: task.assignedScanner
      },
      creditLedger,
      walletLedger
    });
  });
  app.get("/tasks", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const pagination = getPagination(request);
    const query = request.query as AdminTaskQuery;
    const where = buildAdminTaskWhere(query);
    const [items, total] = await Promise.all([
      prisma.task.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit, include: adminTaskInclude }),
      prisma.task.count({ where })
    ]);
    return ok(reply, paginated(items.map(taskReportRow), total, pagination));
  });
  app.get("/reports/:report/export.csv", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const params = request.params as { report: ReportName };
    const query = request.query as ReportQuery;
    const report = await buildReport(params.report, query, 10000);
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="scan-krwalo-${params.report}-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(toCsv(report.items as Array<Record<string, unknown>>));
  });
  app.get("/reports/:report", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const params = request.params as { report: ReportName };
    const pagination = getPagination(request);
    const query = request.query as ReportQuery;
    return ok(reply, await buildReport(params.report, query, pagination.limit, pagination.skip, pagination.page));
  });
  app.get("/disputes", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.taskDispute.findMany({ orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
      prisma.taskDispute.count()
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
  app.post("/disputes/:id/resolve", async (_, reply) => ok(reply, { resolved: true }));
  app.get("/payouts", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.payoutRequest.findMany({ orderBy: { requestedAt: "desc" }, skip: pagination.skip, take: pagination.limit, include: { scanner: { include: { user: true } } } }),
      prisma.payoutRequest.count()
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
  app.post("/payouts/:id/processing", async (request, reply) => {
    const user = await requireRole(request, ["ADMIN"]);
    const params = request.params as { id: string };
    return ok(reply, await transitionPayout(user.id, params.id, "processing", request.body as never));
  });
  app.post("/payouts/:id/paid", async (request, reply) => {
    const user = await requireRole(request, ["ADMIN"]);
    const params = request.params as { id: string };
    return ok(reply, await transitionPayout(user.id, params.id, "paid", request.body as never));
  });
  app.post("/payouts/:id/reject", async (request, reply) => {
    const user = await requireRole(request, ["ADMIN"]);
    const params = request.params as { id: string };
    return ok(reply, await transitionPayout(user.id, params.id, "reject", request.body as never));
  });
  app.get("/audit-logs", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.limit }),
      prisma.auditLog.count()
    ]);
    return ok(reply, paginated(items, total, pagination));
  });
}

function buildAdminTaskWhere(query: AdminTaskQuery): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};
  if (query.status && query.status !== "ALL") where.status = query.status as never;
  if (query.postedByRole && query.postedByRole !== "ALL") where.postedByRole = query.postedByRole as never;

  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { publicId: { contains: search, mode: "insensitive" } },
      { normalizedUrl: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { client: { user: { username: { contains: search, mode: "insensitive" } } } },
      { client: { user: { email: { contains: search, mode: "insensitive" } } } },
      { assignedScanner: { user: { username: { contains: search, mode: "insensitive" } } } },
      { assignedScanner: { user: { email: { contains: search, mode: "insensitive" } } } }
    ];
  }
  return where;
}

function taskReportRow(task: Prisma.TaskGetPayload<{ include: typeof adminTaskInclude }>) {
  return {
    id: task.id,
    publicId: task.publicId,
    status: task.status,
    postedByRole: task.postedByRole,
    title: task.title,
    url: task.normalizedUrl,
    clientUsername: task.client?.user.username ?? "",
    clientEmail: task.client?.user.email ?? "",
    clientAccountStatus: task.client?.user.accountStatus ?? "",
    clientAvailableCredits: task.client?.creditAccount?.availableCredits ?? task.client?.availableTaskCredits ?? "",
    clientReservedCredits: task.client?.creditAccount?.reservedCredits ?? task.client?.reservedTaskCredits ?? "",
    clientUsedCredits: task.client?.creditAccount?.usedCredits ?? task.client?.usedTaskCredits ?? "",
    scannerUsername: task.assignedScanner?.user.username ?? "",
    scannerEmail: task.assignedScanner?.user.email ?? "",
    scannerAccountStatus: task.assignedScanner?.user.accountStatus ?? "",
    scannerAvailableBalance: task.assignedScanner?.wallet?.availableBalance ?? task.assignedScanner?.availableBalance ?? "",
    scannerLifetimeEarnings: task.assignedScanner?.wallet?.lifetimeEarnings ?? task.assignedScanner?.lifetimeEarnings ?? "",
    rewardAmount: task.rewardAmount,
    rewardCurrency: task.rewardCurrency,
    proofCount: task.proofs.length,
    disputeStatus: task.dispute?.status ?? "",
    publishedAt: task.publishedAt,
    claimedAt: task.claimedAt,
    scannerSubmittedAt: task.scannerSubmittedAt,
    clientConfirmedAt: task.clientConfirmedAt,
    completedAt: task.completedAt,
    expiredAt: task.expiredAt,
    cancelledAt: task.cancelledAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const columns = [
    "publicId",
    "status",
    "postedByRole",
    "title",
    "url",
    "clientUsername",
    "clientEmail",
    "clientAccountStatus",
    "clientAvailableCredits",
    "clientReservedCredits",
    "clientUsedCredits",
    "scannerUsername",
    "scannerEmail",
    "scannerAccountStatus",
    "scannerAvailableBalance",
    "scannerLifetimeEarnings",
    "rewardAmount",
    "rewardCurrency",
    "proofCount",
    "disputeStatus",
    "publishedAt",
    "claimedAt",
    "scannerSubmittedAt",
    "clientConfirmedAt",
    "completedAt",
    "expiredAt",
    "cancelledAt",
    "createdAt",
    "updatedAt"
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(column, row[column])).join(","))
  ].join("\n");
}

function csvCell(column: string, value: unknown) {
  const text = isMoneyColumn(column) && value !== null && value !== undefined && value !== ""
    ? minorUnitsToDisplay(value as bigint | number | string)
    : value instanceof Date
    ? value.toISOString()
    : typeof value === "bigint"
      ? value.toString()
      : value == null
        ? ""
        : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function isMoneyColumn(column: string) {
  const lowerColumn = column.toLowerCase();
  return lowerColumn.includes("amount") || lowerColumn.includes("balance") || lowerColumn.includes("earnings") || lowerColumn.includes("reward") || lowerColumn.includes("paid");
}

async function buildReport(report: ReportName, query: ReportQuery, limit: number, skip = 0, page = 1) {
  const range = dateRange(query);
  if (report === "daily-completed") {
    const tasks = await prisma.task.findMany({
      where: {
        status: { in: ["COMPLETED", "AUTO_COMPLETED"] },
        completedAt: range
      },
      select: { completedAt: true, rewardAmount: true, rewardCurrency: true },
      orderBy: { completedAt: "desc" },
      take: 10000
    });
    const grouped = new Map<string, { date: string; completedTasks: number; scannerRewards: bigint; currency: string }>();
    for (const task of tasks) {
      if (!task.completedAt) continue;
      const date = task.completedAt.toISOString().slice(0, 10);
      const current = grouped.get(date) ?? { date, completedTasks: 0, scannerRewards: 0n, currency: task.rewardCurrency };
      current.completedTasks += 1;
      current.scannerRewards += task.rewardAmount;
      grouped.set(date, current);
    }
    return paged([...grouped.values()].sort((a, b) => b.date.localeCompare(a.date)), limit, skip, page);
  }

  if (report === "scanner-earnings") {
    const scanners = await prisma.scannerProfile.findMany({
      include: {
        user: { select: { username: true, email: true, accountStatus: true } },
        wallet: true,
        assignedTasks: { where: { status: { in: ["COMPLETED", "AUTO_COMPLETED"] }, completedAt: range }, select: { id: true, rewardAmount: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 10000
    });
    return paged(scanners.map((scanner) => ({
      scannerId: scanner.id,
      username: scanner.user.username,
      email: scanner.user.email,
      accountStatus: scanner.user.accountStatus,
      completedTasksInRange: scanner.assignedTasks.length,
      earningsInRange: scanner.assignedTasks.reduce((total, task) => total + task.rewardAmount, 0n),
      availableBalance: scanner.wallet?.availableBalance ?? scanner.availableBalance,
      reservedForPayout: scanner.wallet?.reservedForPayout ?? scanner.reservedForPayout,
      lifetimeEarnings: scanner.wallet?.lifetimeEarnings ?? scanner.lifetimeEarnings,
      lifetimePaid: scanner.wallet?.lifetimePaid ?? scanner.lifetimePaid,
      currency: scanner.wallet?.currency ?? "USDT"
    })), limit, skip, page);
  }

  if (report === "client-credit-usage") {
    const clients = await prisma.clientProfile.findMany({
      include: {
        user: { select: { username: true, email: true, accountStatus: true } },
        creditAccount: true,
        tasks: { where: { createdAt: range }, select: { id: true, status: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 10000
    });
    return paged(clients.map((client) => ({
      clientId: client.id,
      username: client.user.username,
      email: client.user.email,
      accountStatus: client.user.accountStatus,
      tasksPostedInRange: client.tasks.length,
      completedInRange: client.tasks.filter((task) => ["COMPLETED", "AUTO_COMPLETED"].includes(task.status)).length,
      failedOrExpiredInRange: client.tasks.filter((task) => ["CLAIM_EXPIRED", "COMPLETION_EXPIRED", "CLIENT_REVIEW_EXPIRED", "CANCELLED", "REFUNDED", "REJECTED"].includes(task.status)).length,
      availableCredits: client.creditAccount?.availableCredits ?? client.availableTaskCredits,
      reservedCredits: client.creditAccount?.reservedCredits ?? client.reservedTaskCredits,
      usedCredits: client.creditAccount?.usedCredits ?? client.usedTaskCredits,
      totalAddedCredits: client.creditAccount?.totalAddedCredits ?? client.totalPurchasedCredits
    })), limit, skip, page);
  }

  if (report === "failed-expired") {
    const where: Prisma.TaskWhereInput = {
      status: { in: ["CLAIM_EXPIRED", "COMPLETION_EXPIRED", "CLIENT_REVIEW_EXPIRED", "CANCELLED", "REFUNDED", "REJECTED", "DISPUTED"] },
      createdAt: range
    };
    const [items, total] = await Promise.all([
      prisma.task.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: adminTaskInclude }),
      prisma.task.count({ where })
    ]);
    return { items: items.map(taskReportRow), pagination: paginationMeta(total, limit, page) };
  }

  if (report === "users") {
    const where = { createdAt: range };
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, select: { id: true, username: true, email: true, role: true, activationStatus: true, accountStatus: true, createdAt: true, updatedAt: true } }),
      prisma.user.count({ where })
    ]);
    return { items, pagination: paginationMeta(total, limit, page) };
  }

  if (report === "payouts") {
    const where = { requestedAt: range };
    const [items, total] = await Promise.all([
      prisma.payoutRequest.findMany({ where, orderBy: { requestedAt: "desc" }, skip, take: limit, include: { scanner: { include: { user: { select: { username: true, email: true } } } } } }),
      prisma.payoutRequest.count({ where })
    ]);
    return { items: items.map((payout) => ({
      payoutId: payout.id,
      scannerUsername: payout.scanner.user.username,
      scannerEmail: payout.scanner.user.email,
      amount: payout.amount,
      currency: payout.currency,
      method: payout.method,
      status: payout.status,
      requestedAt: payout.requestedAt,
      processingAt: payout.processingAt,
      paidAt: payout.paidAt,
      rejectedAt: payout.rejectedAt,
      transactionReference: payout.transactionReference,
      rejectionReason: payout.rejectionReason
    })), pagination: paginationMeta(total, limit, page) };
  }

  if (report === "wallets") {
    const where = { createdAt: range };
    const [items, total] = await Promise.all([
      prisma.scannerWalletTransaction.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: { wallet: { include: { scanner: { include: { user: { select: { username: true, email: true } } } } } } } }),
      prisma.scannerWalletTransaction.count({ where })
    ]);
    return { items: items.map((item) => ({
      transactionId: item.id,
      scannerUsername: item.wallet.scanner.user.username,
      scannerEmail: item.wallet.scanner.user.email,
      type: item.type,
      direction: item.direction,
      amount: item.amount,
      currency: item.currency,
      availableBefore: item.availableBefore,
      availableAfter: item.availableAfter,
      reservedBefore: item.reservedBefore,
      reservedAfter: item.reservedAfter,
      referenceType: item.referenceType,
      referenceId: item.referenceId,
      description: item.description,
      createdAt: item.createdAt
    })), pagination: paginationMeta(total, limit, page) };
  }

  if (report === "credits") {
    const where = { createdAt: range };
    const [items, total] = await Promise.all([
      prisma.clientCreditTransaction.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: { account: { include: { client: { include: { user: { select: { username: true, email: true } } } } } } } }),
      prisma.clientCreditTransaction.count({ where })
    ]);
    return { items: items.map((item) => ({
      transactionId: item.id,
      clientUsername: item.account.client.user.username,
      clientEmail: item.account.client.user.email,
      type: item.type,
      direction: item.direction,
      amount: item.amount,
      availableBefore: item.availableBefore,
      availableAfter: item.availableAfter,
      reservedBefore: item.reservedBefore,
      reservedAfter: item.reservedAfter,
      usedBefore: item.usedBefore,
      usedAfter: item.usedAfter,
      referenceType: item.referenceType,
      referenceId: item.referenceId,
      description: item.description,
      createdAt: item.createdAt
    })), pagination: paginationMeta(total, limit, page) };
  }

  throw new DomainError("FORBIDDEN", "Unknown report.", 404);
}

function dateRange(query: ReportQuery): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  if (query.startDate) {
    const start = new Date(`${query.startDate}T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime())) range.gte = start;
  }
  if (query.endDate) {
    const end = new Date(`${query.endDate}T23:59:59.999Z`);
    if (!Number.isNaN(end.getTime())) range.lte = end;
  }
  return Object.keys(range).length ? range : undefined;
}

function paged<T>(allItems: T[], limit: number, skip: number, page: number) {
  const total = allItems.length;
  return { items: allItems.slice(skip, skip + limit), pagination: paginationMeta(total, limit, page) };
}

function paginationMeta(total: number, limit: number, page: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}
