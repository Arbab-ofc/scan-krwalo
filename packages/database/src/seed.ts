import { hash } from "@node-rs/argon2";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  displayToMinorUnits,
  generateActivationCode,
  hashActivationCode,
  maskActivationCode,
  normalizeTaskUrl
} from "@scan-krwalo/shared";

const prisma = new PrismaClient();

const defaultSettings = {
  platformName: "Scan Krwalo",
  platformTagline: "Post. Grab. Complete. Earn.",
  defaultScannerReward: "1000",
  rewardCurrency: "USDT",
  taskClaimWindowSeconds: 120,
  taskCompletionWindowSeconds: 180,
  clientReviewWindowSeconds: 900,
  minimumPayoutAmount: "50",
  allowPartialPayout: true,
  telegramUsername: "ScanKrwaloAdmin",
  telegramContactEnabled: true,
  scannerCooldownSeconds: 0,
  maxActiveTasksPerScanner: 1,
  proofRequired: false,
  maxProofFileSize: 5242880,
  blockedDomains: [],
  maintenanceMode: false,
  registrationEnabled: true,
  browserPushEnabled: true,
  supportedPayoutMethods: ["BINANCE_ID", "USDT_BEP20"]
};

async function upsertSetting(key: string, value: Prisma.InputJsonValue) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}

async function main() {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error("ADMIN_SEED_PASSWORD must be provided and at least 12 characters");
  }

  for (const [key, value] of Object.entries(defaultSettings)) {
    await upsertSetting(key, value);
  }

  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_SEED_EMAIL ?? "admin@scan-krwalo.local" },
    update: {},
    create: {
      username: process.env.ADMIN_SEED_USERNAME ?? "admin",
      email: process.env.ADMIN_SEED_EMAIL ?? "admin@scan-krwalo.local",
      passwordHash: await hash(adminPassword),
      role: "ADMIN",
      activationStatus: "ACTIVE"
    }
  });

  const scannerUser = await prisma.user.upsert({
    where: { email: "scanner@scan-krwalo.local" },
    update: {},
    create: {
      username: "scanner_seed",
      email: "scanner@scan-krwalo.local",
      passwordHash: await hash("ScannerSeed123!"),
      role: "SCANNER",
      activationStatus: "ACTIVE"
    }
  });

  const scanner = await prisma.scannerProfile.upsert({
    where: { userId: scannerUser.id },
    update: {},
    create: {
      userId: scannerUser.id,
      binanceId: "scanner_seed",
      preferredPayoutMethod: "BINANCE_ID",
      wallet: { create: { currency: "USDT" } }
    }
  });

  const clientUser = await prisma.user.upsert({
    where: { email: "client@scan-krwalo.local" },
    update: {},
    create: {
      username: "client_seed",
      email: "client@scan-krwalo.local",
      passwordHash: await hash("ClientSeed123!"),
      role: "CLIENT",
      activationStatus: "ACTIVE"
    }
  });

  const client = await prisma.clientProfile.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: {
      userId: clientUser.id,
      availableTaskCredits: 10,
      totalPurchasedCredits: 10,
      creditAccount: {
        create: {
          availableCredits: 10,
          totalAddedCredits: 10
        }
      }
    },
    include: { creditAccount: true }
  });

  await prisma.user.upsert({
    where: { email: "inactive@scan-krwalo.local" },
    update: {},
    create: {
      username: "inactive_seed",
      email: "inactive@scan-krwalo.local",
      passwordHash: await hash("InactiveSeed123!")
    }
  });

  const scannerCode = generateActivationCode("SCANNER");
  const clientCode = generateActivationCode("CLIENT");
  const secret = process.env.JWT_ACCESS_SECRET ?? "local-seed-secret";
  await prisma.activationCode.createMany({
    data: [
      {
        codeHash: hashActivationCode(scannerCode, secret),
        fullCode: scannerCode,
        codePreview: maskActivationCode(scannerCode),
        codeType: "SCANNER",
        createdByAdminId: admin.id
      },
      {
        codeHash: hashActivationCode(clientCode, secret),
        fullCode: clientCode,
        codePreview: maskActivationCode(clientCode),
        codeType: "CLIENT",
        initialTaskCredits: 25,
        recordedPrice: displayToMinorUnits("250.00"),
        createdByAdminId: admin.id
      }
    ],
    skipDuplicates: true
  });

  const { normalizedUrl, urlHash } = normalizeTaskUrl("https://example.com/scan-krwalo-seed");
  await prisma.task.upsert({
    where: { publicId: "TASK-SEED-AVAILABLE" },
    update: {},
    create: {
      publicId: "TASK-SEED-AVAILABLE",
      postedByUserId: clientUser.id,
      postedByRole: "CLIENT",
      clientId: client.id,
      url: "https://example.com/scan-krwalo-seed",
      normalizedUrl,
      urlHash,
      title: "Seed available task",
      status: "AVAILABLE",
      rewardAmount: 1000n,
      rewardCurrency: "USDT",
      rewardConfiguredAt: new Date(),
      claimWindowSeconds: 120,
      completionWindowSeconds: 150,
      clientReviewWindowSeconds: 900,
      publishedAt: new Date(),
      claimExpiresAt: new Date(Date.now() + 120_000),
      events: {
        create: {
          eventType: "TASK_CREATED",
          newStatus: "AVAILABLE",
          actorUserId: clientUser.id,
          actorRole: "CLIENT"
        }
      }
    }
  });

  await prisma.payoutRequest.createMany({
    data: [
      {
        scannerId: scanner.id,
        amount: 1000n,
        currency: "USDT",
        method: "BINANCE_ID",
        destinationSnapshot: { binanceId: "scanner_seed" },
        status: "REQUESTED",
        idempotencyKey: `seed:payout:${scanner.id}`
      }
    ],
    skipDuplicates: true
  });

  console.log("Seed complete");
  console.log(`Admin: ${admin.email}`);
  console.log(`Scanner code shown once: ${scannerCode}`);
  console.log(`Client code shown once: ${clientCode}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
