import { Prisma, prisma } from "@scan-krwalo/database";
import { bep20AddressSchema, binanceIdSchema, displayToMinorUnits, DomainError, payoutRequestSchema } from "@scan-krwalo/shared";
import { getSettings } from "./settings.service.js";
import { emitToRole, emitToUser } from "../realtime.js";

export async function updateScannerProfile(userId: string, input: { binanceId?: string; usdtBep20Address?: string; preferredPayoutMethod?: "BINANCE_ID" | "USDT_BEP20" }) {
  const data: typeof input = {};
  const binanceId = input.binanceId?.trim();
  const usdtBep20Address = input.usdtBep20Address?.trim();
  if (binanceId) data.binanceId = binanceIdSchema.parse(binanceId);
  if (usdtBep20Address) data.usdtBep20Address = bep20AddressSchema.parse(usdtBep20Address).toLowerCase();
  if (input.preferredPayoutMethod) data.preferredPayoutMethod = input.preferredPayoutMethod;
  const scanner = await prisma.scannerProfile.update({ where: { userId }, data });
  await prisma.auditLog.create({ data: { actorUserId: userId, action: "PAYOUT_ADDRESS_CHANGED", entityType: "ScannerProfile", entityId: scanner.id, afterData: data } });
  return scanner;
}

export async function requestPayout(userId: string, input: unknown) {
  const data = payoutRequestSchema.parse(input);
  const amount = displayToMinorUnits(data.amount);
  const settings = await getSettings();
  const minimum = BigInt(settings.minimumPayoutAmount);
  if (amount < minimum) throw new DomainError("PAYOUT_BELOW_MINIMUM", "Payout amount is below the minimum.", 409);
  const payout = await prisma.$transaction(async (tx) => {
    const scanner = await tx.scannerProfile.findUnique({ where: { userId }, include: { wallet: true } });
    if (!scanner?.wallet) throw new DomainError("FORBIDDEN", "Scanner wallet required.", 403);
    if (scanner.wallet.availableBalance < amount) throw new DomainError("PAYOUT_INSUFFICIENT_BALANCE", "Insufficient available balance.", 409);
    const destinationSnapshot = data.method === "BINANCE_ID"
      ? { binanceId: scanner.binanceId }
      : { usdtBep20Address: scanner.usdtBep20Address };
    if (!Object.values(destinationSnapshot)[0]) throw new DomainError("PAYOUT_INVALID_DESTINATION", "Complete payout details first.", 409);
    const payout = await tx.payoutRequest.create({
      data: {
        scannerId: scanner.id,
        amount,
        currency: scanner.wallet.currency,
        method: data.method,
        destinationSnapshot,
        idempotencyKey: `payout:${scanner.id}:${Date.now()}`
      }
    });
    await tx.scannerWalletTransaction.create({
      data: {
        walletId: scanner.wallet.id,
        type: "PAYOUT_RESERVATION",
        direction: "DEBIT",
        amount,
        currency: scanner.wallet.currency,
        availableBefore: scanner.wallet.availableBalance,
        availableAfter: scanner.wallet.availableBalance - amount,
        pendingBefore: scanner.wallet.pendingBalance,
        pendingAfter: scanner.wallet.pendingBalance,
        reservedBefore: scanner.wallet.reservedForPayout,
        reservedAfter: scanner.wallet.reservedForPayout + amount,
        referenceType: "PayoutRequest",
        referenceId: payout.id,
        idempotencyKey: `payout:${payout.id}:reserve`,
        description: "Payout amount reserved",
        createdByUserId: userId
      }
    });
    await tx.scannerWallet.update({ where: { id: scanner.wallet.id }, data: { availableBalance: { decrement: amount }, reservedForPayout: { increment: amount } } });
    await tx.scannerProfile.update({ where: { id: scanner.id }, data: { availableBalance: { decrement: amount }, reservedForPayout: { increment: amount } } });
    await tx.auditLog.create({ data: { actorUserId: userId, action: "PAYOUT_REQUESTED", entityType: "PayoutRequest", entityId: payout.id } });
    return payout;
  });
  emitToUser(userId, "payout:updated", { payoutId: payout.id, status: payout.status });
  emitToUser(userId, "wallet:updated", { payoutId: payout.id });
  emitToRole("ADMIN", "payout:updated", { payoutId: payout.id, status: payout.status });
  return payout;
}

export async function transitionPayout(adminId: string, payoutId: string, action: "processing" | "paid" | "reject", input: { transactionReference?: string; rejectionReason?: string; adminNote?: string }) {
  const updated = await prisma.$transaction(async (tx) => {
    const payout = await tx.payoutRequest.findUnique({ where: { id: payoutId }, include: { scanner: { include: { wallet: true } } } });
    if (!payout?.scanner.wallet) throw new DomainError("PAYOUT_INVALID_DESTINATION", "Payout not found.", 404);
    if (action === "processing") {
      if (payout.status === "PROCESSING") return payout;
      if (payout.status !== "REQUESTED") throw new DomainError("TASK_INVALID_STATE", "Payout cannot be marked processing.", 409);
      const updated = await tx.payoutRequest.update({ where: { id: payoutId }, data: { status: "PROCESSING", processingAt: new Date(), processedByAdminId: adminId } });
      await tx.auditLog.create({ data: { actorUserId: adminId, action: "PAYOUT_PROCESSING", entityType: "PayoutRequest", entityId: payoutId } });
      return updated;
    }
    if (action === "paid") {
      if (payout.status === "PAID") return payout;
      if (!["REQUESTED", "PROCESSING"].includes(payout.status)) throw new DomainError("TASK_INVALID_STATE", "Payout cannot be paid.", 409);
      const wallet = payout.scanner.wallet;
      await tx.scannerWalletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "PAYOUT_COMPLETION",
          direction: "DEBIT",
          amount: payout.amount,
          currency: payout.currency,
          availableBefore: wallet.availableBalance,
          availableAfter: wallet.availableBalance,
          pendingBefore: wallet.pendingBalance,
          pendingAfter: wallet.pendingBalance,
          reservedBefore: wallet.reservedForPayout,
          reservedAfter: wallet.reservedForPayout - payout.amount,
          referenceType: "PayoutRequest",
          referenceId: payout.id,
          idempotencyKey: `payout:${payout.id}:paid`,
          description: "Payout marked paid",
          createdByUserId: adminId
        }
      });
      await tx.scannerWallet.update({ where: { id: payout.scanner.wallet.id }, data: { reservedForPayout: { decrement: payout.amount }, lifetimePaid: { increment: payout.amount } } });
      await tx.scannerProfile.update({ where: { id: payout.scanner.id }, data: { reservedForPayout: { decrement: payout.amount }, lifetimePaid: { increment: payout.amount } } });
      const updated = await tx.payoutRequest.update({ where: { id: payoutId }, data: { status: "PAID", paidAt: new Date(), processedByAdminId: adminId, transactionReference: input.transactionReference, adminNote: input.adminNote } });
      await tx.auditLog.create({ data: { actorUserId: adminId, action: "PAYOUT_PAID", entityType: "PayoutRequest", entityId: payoutId, afterData: { transactionReference: input.transactionReference, adminNote: input.adminNote } } });
      return updated;
    }
    if (payout.status === "REJECTED") return payout;
    if (!["REQUESTED", "PROCESSING"].includes(payout.status)) throw new DomainError("TASK_INVALID_STATE", "Payout cannot be rejected.", 409);
    const wallet = payout.scanner.wallet;
    await tx.scannerWalletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "PAYOUT_RELEASE",
        direction: "CREDIT",
        amount: payout.amount,
        currency: payout.currency,
        availableBefore: wallet.availableBalance,
        availableAfter: wallet.availableBalance + payout.amount,
        pendingBefore: wallet.pendingBalance,
        pendingAfter: wallet.pendingBalance,
        reservedBefore: wallet.reservedForPayout,
        reservedAfter: wallet.reservedForPayout - payout.amount,
        referenceType: "PayoutRequest",
        referenceId: payout.id,
        idempotencyKey: `payout:${payout.id}:reject`,
        description: "Payout rejected and released",
        createdByUserId: adminId
      }
    });
    await tx.scannerWallet.update({ where: { id: payout.scanner.wallet.id }, data: { reservedForPayout: { decrement: payout.amount }, availableBalance: { increment: payout.amount } } });
    await tx.scannerProfile.update({ where: { id: payout.scanner.id }, data: { reservedForPayout: { decrement: payout.amount }, availableBalance: { increment: payout.amount } } });
    const updated = await tx.payoutRequest.update({ where: { id: payoutId }, data: { status: "REJECTED", rejectedAt: new Date(), processedByAdminId: adminId, rejectionReason: input.rejectionReason, adminNote: input.adminNote } });
    await tx.auditLog.create({ data: { actorUserId: adminId, action: "PAYOUT_REJECTED", entityType: "PayoutRequest", entityId: payoutId, afterData: { rejectionReason: input.rejectionReason, adminNote: input.adminNote } } });
    return updated;
  }, { maxWait: 10_000, timeout: 20_000 });
  const scanner = await prisma.scannerProfile.findUnique({ where: { id: updated.scannerId }, select: { userId: true } });
  if (scanner) {
    emitToUser(scanner.userId, "payout:updated", { payoutId: updated.id, status: updated.status });
    emitToUser(scanner.userId, "wallet:updated", { payoutId: updated.id });
  }
  emitToRole("ADMIN", "payout:updated", { payoutId: updated.id, status: updated.status });
  return updated;
}
