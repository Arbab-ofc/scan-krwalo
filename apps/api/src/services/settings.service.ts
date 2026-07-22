import { Prisma, prisma } from "@scan-krwalo/database";
import { displayToMinorUnits, normalizeTelegramUsername } from "@scan-krwalo/shared";

const defaults = {
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
  blockedDomains: [] as string[],
  supportedPayoutMethods: ["BINANCE_ID", "USDT_BEP20"],
  browserPushEnabled: true
};

export type Settings = typeof defaults;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.systemSetting.findMany();
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...defaults, ...values } as Settings;
}

export async function updateSettings(input: Record<string, unknown>, actorUserId: string) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(key in defaults)) continue;
    if (key === "telegramUsername") normalized[key] = normalizeTelegramUsername(String(value));
    else if (key === "defaultScannerReward" || key === "minimumPayoutAmount") normalized[key] = displayToMinorUnits(String(value)).toString();
    else normalized[key] = value;
  }
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(normalized)) {
      const jsonValue = value as Prisma.InputJsonValue;
      await tx.systemSetting.upsert({
        where: { key },
        update: { value: jsonValue, updatedByUserId: actorUserId },
        create: { key, value: jsonValue, updatedByUserId: actorUserId }
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "SETTING_UPDATED",
          entityType: "SystemSetting",
          entityId: key,
          afterData: { value: jsonValue }
        }
      });
    }
  });
  return getSettings();
}
