-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SCANNER', 'CLIENT');

-- CreateEnum
CREATE TYPE "ActivationStatus" AS ENUM ('INACTIVE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ActivationCodeType" AS ENUM ('SCANNER', 'CLIENT');

-- CreateEnum
CREATE TYPE "ActivationCodeStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ScannerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'CLAIMED', 'SCANNER_SUBMITTED', 'CLIENT_CONFIRMED', 'COMPLETED', 'CLAIM_EXPIRED', 'COMPLETION_EXPIRED', 'CLIENT_REVIEW_EXPIRED', 'CANCELLED', 'DISPUTED', 'REFUNDED', 'REJECTED', 'AUTO_COMPLETED');

-- CreateEnum
CREATE TYPE "PostedByRole" AS ENUM ('ADMIN', 'CLIENT');

-- CreateEnum
CREATE TYPE "RewardSource" AS ENUM ('DEFAULT', 'ADMIN_CUSTOM');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('ACTIVATION_CODE_REDEMPTION', 'TASK_RESERVATION', 'TASK_COMPLETION', 'TASK_REFUND', 'ADMIN_ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TASK_REWARD', 'PAYOUT_RESERVATION', 'PAYOUT_COMPLETION', 'PAYOUT_RELEASE', 'ADMIN_ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BINANCE_ID', 'USDT_BEP20');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_FOR_SCANNER', 'RESOLVED_FOR_CLIENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_AVAILABLE', 'TASK_CLAIMED', 'TASK_NO_LONGER_AVAILABLE', 'TASK_COMPLETION_WARNING', 'TASK_COMPLETION_EXPIRED', 'TASK_SUBMITTED', 'TASK_CONFIRMED', 'TASK_DISPUTED', 'TASK_AUTO_COMPLETED', 'WALLET_CREDITED', 'PAYOUT_REQUESTED', 'PAYOUT_PROCESSING', 'PAYOUT_PAID', 'PAYOUT_REJECTED', 'CODE_REDEEMED', 'ACCOUNT_SUSPENDED', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "activationStatus" "ActivationStatus" NOT NULL DEFAULT 'INACTIVE',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ScannerStatus" NOT NULL DEFAULT 'ACTIVE',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastHeartbeatAt" TIMESTAMP(3),
    "binanceId" TEXT,
    "usdtBep20Address" TEXT,
    "preferredPayoutMethod" "PayoutMethod",
    "availableBalance" BIGINT NOT NULL DEFAULT 0,
    "pendingBalance" BIGINT NOT NULL DEFAULT 0,
    "reservedForPayout" BIGINT NOT NULL DEFAULT 0,
    "lifetimeEarnings" BIGINT NOT NULL DEFAULT 0,
    "lifetimePaid" BIGINT NOT NULL DEFAULT 0,
    "completedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "failedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "expiredTaskCount" INTEGER NOT NULL DEFAULT 0,
    "disputedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastTaskClaimedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScannerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "availableTaskCredits" INTEGER NOT NULL DEFAULT 0,
    "reservedTaskCredits" INTEGER NOT NULL DEFAULT 0,
    "usedTaskCredits" INTEGER NOT NULL DEFAULT 0,
    "totalPurchasedCredits" INTEGER NOT NULL DEFAULT 0,
    "totalPostedTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "cancelledTasks" INTEGER NOT NULL DEFAULT 0,
    "disputedTasks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePreview" TEXT NOT NULL,
    "codeType" "ActivationCodeType" NOT NULL,
    "initialTaskCredits" INTEGER,
    "recordedPrice" BIGINT,
    "status" "ActivationCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedByUserId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByAdminId" TEXT,
    "revocationReason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ActivationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "postedByUserId" TEXT NOT NULL,
    "postedByRole" "PostedByRole" NOT NULL,
    "clientId" TEXT,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "title" TEXT,
    "instructions" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'DRAFT',
    "rewardAmount" BIGINT NOT NULL,
    "rewardCurrency" TEXT NOT NULL DEFAULT 'INR',
    "rewardSource" "RewardSource" NOT NULL DEFAULT 'DEFAULT',
    "rewardConfiguredAt" TIMESTAMP(3) NOT NULL,
    "claimWindowSeconds" INTEGER NOT NULL,
    "completionWindowSeconds" INTEGER NOT NULL,
    "clientReviewWindowSeconds" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "claimExpiresAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "completionExpiresAt" TIMESTAMP(3),
    "scannerSubmittedAt" TIMESTAMP(3),
    "clientConfirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "assignedScannerId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskClaim" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "scannerId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "TaskClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSubmission" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "scannerId" TEXT NOT NULL,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskProof" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" "TaskStatus",
    "newStatus" "TaskStatus" NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDispute" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "scannerResponse" TEXT,
    "adminResolution" TEXT,
    "resolvedByAdminId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCreditAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "availableCredits" INTEGER NOT NULL DEFAULT 0,
    "reservedCredits" INTEGER NOT NULL DEFAULT 0,
    "usedCredits" INTEGER NOT NULL DEFAULT 0,
    "totalAddedCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCreditTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "availableBefore" INTEGER NOT NULL,
    "availableAfter" INTEGER NOT NULL,
    "reservedBefore" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "usedBefore" INTEGER NOT NULL,
    "usedAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "ClientCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerWallet" (
    "id" TEXT NOT NULL,
    "scannerId" TEXT NOT NULL,
    "availableBalance" BIGINT NOT NULL DEFAULT 0,
    "pendingBalance" BIGINT NOT NULL DEFAULT 0,
    "reservedForPayout" BIGINT NOT NULL DEFAULT 0,
    "lifetimeEarnings" BIGINT NOT NULL DEFAULT 0,
    "lifetimePaid" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScannerWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerWalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "availableBefore" BIGINT NOT NULL,
    "availableAfter" BIGINT NOT NULL,
    "pendingBefore" BIGINT NOT NULL,
    "pendingAfter" BIGINT NOT NULL,
    "reservedBefore" BIGINT NOT NULL,
    "reservedAfter" BIGINT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "ScannerWalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "scannerId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "destinationSnapshot" JSONB NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "processedByAdminId" TEXT,
    "transactionReference" TEXT,
    "adminNote" TEXT,
    "rejectionReason" TEXT,
    "paymentProofStorageKey" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScannerProfile_userId_key" ON "ScannerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_userId_key" ON "ClientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_codeHash_key" ON "ActivationCode"("codeHash");

-- CreateIndex
CREATE INDEX "ActivationCode_status_idx" ON "ActivationCode"("status");

-- CreateIndex
CREATE INDEX "ActivationCode_codeType_idx" ON "ActivationCode"("codeType");

-- CreateIndex
CREATE INDEX "ActivationCode_codePreview_idx" ON "ActivationCode"("codePreview");

-- CreateIndex
CREATE UNIQUE INDEX "Task_publicId_key" ON "Task"("publicId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_claimExpiresAt_idx" ON "Task"("claimExpiresAt");

-- CreateIndex
CREATE INDEX "Task_completionExpiresAt_idx" ON "Task"("completionExpiresAt");

-- CreateIndex
CREATE INDEX "Task_assignedScannerId_idx" ON "Task"("assignedScannerId");

-- CreateIndex
CREATE INDEX "Task_clientId_idx" ON "Task"("clientId");

-- CreateIndex
CREATE INDEX "Task_urlHash_idx" ON "Task"("urlHash");

-- CreateIndex
CREATE INDEX "TaskClaim_scannerId_status_idx" ON "TaskClaim"("scannerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskClaim_taskId_scannerId_key" ON "TaskClaim"("taskId", "scannerId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSubmission_idempotencyKey_key" ON "TaskSubmission"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_createdAt_idx" ON "TaskEvent"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDispute_taskId_key" ON "TaskDispute"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCreditAccount_clientId_key" ON "ClientCreditAccount"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCreditTransaction_idempotencyKey_key" ON "ClientCreditTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ClientCreditTransaction_clientId_createdAt_idx" ON "ClientCreditTransaction"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScannerWallet_scannerId_key" ON "ScannerWallet"("scannerId");

-- CreateIndex
CREATE UNIQUE INDEX "ScannerWalletTransaction_idempotencyKey_key" ON "ScannerWalletTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ScannerWalletTransaction_walletId_createdAt_idx" ON "ScannerWalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRequest_idempotencyKey_key" ON "PayoutRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PayoutRequest_status_requestedAt_idx" ON "PayoutRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannerProfile" ADD CONSTRAINT "ScannerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedScannerId_fkey" FOREIGN KEY ("assignedScannerId") REFERENCES "ScannerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskClaim" ADD CONSTRAINT "TaskClaim_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskClaim" ADD CONSTRAINT "TaskClaim_scannerId_fkey" FOREIGN KEY ("scannerId") REFERENCES "ScannerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProof" ADD CONSTRAINT "TaskProof_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDispute" ADD CONSTRAINT "TaskDispute_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditAccount" ADD CONSTRAINT "ClientCreditAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditTransaction" ADD CONSTRAINT "ClientCreditTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientCreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannerWallet" ADD CONSTRAINT "ScannerWallet_scannerId_fkey" FOREIGN KEY ("scannerId") REFERENCES "ScannerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannerWalletTransaction" ADD CONSTRAINT "ScannerWalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ScannerWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_scannerId_fkey" FOREIGN KEY ("scannerId") REFERENCES "ScannerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

