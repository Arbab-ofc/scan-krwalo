import { Prisma, prisma } from "@scan-krwalo/database";
import {
  DomainError,
  displayToMinorUnits,
  generateActivationCode,
  hashActivationCode,
  maskActivationCode,
  normalizeActivationCode,
  validateActivationCodeFormat
} from "@scan-krwalo/shared";
import { env } from "../env.js";
import { paginated, type Pagination } from "../pagination.js";

export async function createActivationCode(input: {
  type: "SCANNER" | "CLIENT";
  adminId: string;
  initialTaskCredits?: number;
  recordedPrice?: string;
  expiresAt?: string;
}) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const fullCode = generateActivationCode(input.type);
    const codeHash = hashActivationCode(fullCode, env.JWT_ACCESS_SECRET);
    try {
      const code = await prisma.activationCode.create({
        data: {
          codeHash,
          fullCode,
          codePreview: maskActivationCode(fullCode),
          codeType: input.type,
          initialTaskCredits: input.type === "CLIENT" ? input.initialTaskCredits : null,
          recordedPrice: input.recordedPrice ? displayToMinorUnits(input.recordedPrice) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          createdByAdminId: input.adminId
        }
      });
      await prisma.auditLog.create({
        data: {
          actorUserId: input.adminId,
          action: "CODE_CREATED",
          entityType: "ActivationCode",
          entityId: code.id,
          afterData: { codePreview: code.codePreview, codeType: code.codeType }
        }
      });
      return serializeActivationCode({ ...code, redeemedByUser: null });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new DomainError("INTERNAL_ERROR", "Could not generate a unique activation code.", 500);
}

function serializeActivationCode(code: Awaited<ReturnType<typeof prisma.activationCode.findMany>>[number] & {
  redeemedByUser?: { id: string; username: string; email: string } | null;
}) {
  const isExpiredByDate = Boolean(code.expiresAt && code.expiresAt <= new Date());
  const effectiveStatus = code.status === "ACTIVE" && isExpiredByDate ? "EXPIRED" : code.status;
  return {
    id: code.id,
    fullCode: code.fullCode,
    codePreview: code.codePreview,
    codeType: code.codeType,
    initialTaskCredits: code.initialTaskCredits,
    recordedPrice: code.recordedPrice?.toString() ?? null,
    status: code.status,
    effectiveStatus,
    isExpired: effectiveStatus === "EXPIRED",
    isUseful: effectiveStatus === "ACTIVE",
    expiresAt: code.expiresAt,
    createdAt: code.createdAt,
    redeemedAt: code.redeemedAt,
    revokedAt: code.revokedAt,
    revocationReason: code.revocationReason,
    redeemedByUser: code.redeemedByUser ?? null
  };
}

export async function listActivationCodes(pagination: Pagination) {
  await prisma.activationCode.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: new Date() }
    },
    data: { status: "EXPIRED" }
  });
  const [codes, total] = await Promise.all([
    prisma.activationCode.findMany({
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.limit,
      include: { redeemedByUser: { select: { id: true, username: true, email: true } } }
    }),
    prisma.activationCode.count()
  ]);
  return paginated(codes.map(serializeActivationCode), total, pagination);
}

export async function getActivationCode(id: string) {
  const code = await prisma.activationCode.findUnique({
    where: { id },
    include: { redeemedByUser: { select: { id: true, username: true, email: true } } }
  });
  return code ? serializeActivationCode(code) : null;
}

export async function redeemActivationCode(userId: string, rawCode: string) {
  const codeValue = normalizeActivationCode(rawCode);
  if (!validateActivationCodeFormat(codeValue)) {
    throw new DomainError("ACTIVATION_CODE_INVALID", "Activation code is invalid.", 400);
  }
  const codeHash = hashActivationCode(codeValue, env.JWT_ACCESS_SECRET);
  return prisma.$transaction(async (tx) => {
    const code = await tx.activationCode.findUnique({ where: { codeHash } });
    if (!code) throw new DomainError("ACTIVATION_CODE_INVALID", "Activation code is invalid.", 404);
    if (code.status === "REDEEMED") throw new DomainError("ACTIVATION_CODE_REDEEMED", "Activation code has already been redeemed.", 409);
    if (code.status !== "ACTIVE") throw new DomainError("ACTIVATION_CODE_INVALID", "Activation code is not active.", 409);
    if (code.expiresAt && code.expiresAt < new Date()) {
      await tx.activationCode.update({ where: { id: code.id }, data: { status: "EXPIRED" } });
      throw new DomainError("ACTIVATION_CODE_EXPIRED", "Activation code has expired.", 409);
    }

    const user = await tx.user.findUnique({ where: { id: userId }, include: { scannerProfile: true, clientProfile: { include: { creditAccount: true } } } });
    if (!user) throw new DomainError("FORBIDDEN", "Authentication required.", 401);
    if (code.codeType === "SCANNER" && user.role === "CLIENT") throw new DomainError("ACTIVATION_CODE_ROLE_CONFLICT", "Client accounts cannot redeem scanner codes.", 409);
    if (code.codeType === "CLIENT" && user.role === "SCANNER") throw new DomainError("ACTIVATION_CODE_ROLE_CONFLICT", "Scanner accounts cannot redeem client codes.", 409);
    if (code.codeType === "SCANNER" && user.role === "SCANNER") throw new DomainError("ACTIVATION_CODE_ROLE_CONFLICT", "Scanner profile is already active.", 409);

    if (code.codeType === "SCANNER") {
      const scanner = await tx.scannerProfile.create({
        data: {
          userId,
          wallet: { create: { currency: "USDT" } }
        }
      });
      await tx.user.update({ where: { id: userId }, data: { role: "SCANNER", activationStatus: "ACTIVE" } });
      await tx.activationCode.update({ where: { id: code.id }, data: { status: "REDEEMED", redeemedByUserId: userId, redeemedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: userId, action: "CODE_REDEEMED", entityType: "ActivationCode", entityId: code.id } });
      return { role: "SCANNER", scannerId: scanner.id };
    }

    const credits = code.initialTaskCredits ?? 0;
    let client = user.clientProfile;
    if (!client) {
      client = await tx.clientProfile.create({
        data: {
          userId,
          availableTaskCredits: credits,
          totalPurchasedCredits: credits,
          creditAccount: { create: { availableCredits: credits, totalAddedCredits: credits } }
        },
        include: { creditAccount: true }
      });
      await tx.user.update({ where: { id: userId }, data: { role: "CLIENT", activationStatus: "ACTIVE" } });
    } else {
      const account = client.creditAccount ?? await tx.clientCreditAccount.create({ data: { clientId: client.id } });
      await tx.clientCreditTransaction.create({
        data: {
          accountId: account.id,
          clientId: client.id,
          type: "ACTIVATION_CODE_REDEMPTION",
          direction: "CREDIT",
          amount: credits,
          availableBefore: account.availableCredits,
          availableAfter: account.availableCredits + credits,
          reservedBefore: account.reservedCredits,
          reservedAfter: account.reservedCredits,
          usedBefore: account.usedCredits,
          usedAfter: account.usedCredits,
          referenceType: "ActivationCode",
          referenceId: code.id,
          idempotencyKey: `code:${code.id}:redeem`,
          description: "Client activation code redeemed",
          createdByUserId: userId
        }
      });
      await tx.clientCreditAccount.update({
        where: { id: account.id },
        data: { availableCredits: { increment: credits }, totalAddedCredits: { increment: credits } }
      });
      await tx.clientProfile.update({
        where: { id: client.id },
        data: { availableTaskCredits: { increment: credits }, totalPurchasedCredits: { increment: credits } }
      });
    }
    await tx.activationCode.update({ where: { id: code.id }, data: { status: "REDEEMED", redeemedByUserId: userId, redeemedAt: new Date() } });
    await tx.auditLog.create({ data: { actorUserId: userId, action: "CODE_REDEEMED", entityType: "ActivationCode", entityId: code.id } });
    return { role: "CLIENT", creditsAdded: credits };
  }, { maxWait: 10_000, timeout: 20_000 });
}
