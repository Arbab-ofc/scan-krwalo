import { prisma } from "@scan-krwalo/database";

export const SCANNER_ONLINE_WINDOW_MS = 70_000;

export function scannerOnlineSince(now = new Date()) {
  return new Date(now.getTime() - SCANNER_ONLINE_WINDOW_MS);
}

export async function countOnlineScanners() {
  return prisma.scannerProfile.count({
    where: {
      status: "ACTIVE",
      isOnline: true,
      lastHeartbeatAt: { gte: scannerOnlineSince() },
      user: {
        role: "SCANNER",
        activationStatus: "ACTIVE",
        accountStatus: "ACTIVE"
      },
      assignedTasks: {
        none: { status: { in: ["CLAIMED", "SCANNER_SUBMITTED", "DISPUTED"] } }
      }
    }
  });
}

export async function setScannerOnline(userId: string, online: boolean) {
  return prisma.scannerProfile.update({
    where: { userId },
    data: {
      isOnline: online,
      lastHeartbeatAt: online ? new Date() : undefined
    }
  });
}

export async function recordScannerHeartbeat(userId: string) {
  const scanner = await prisma.scannerProfile.findUnique({ where: { userId } });
  if (!scanner?.isOnline || scanner.status !== "ACTIVE") return null;
  return prisma.scannerProfile.update({
    where: { id: scanner.id },
    data: { lastHeartbeatAt: new Date() }
  });
}

export function isScannerRecentlyOnline(scanner: { isOnline: boolean; lastHeartbeatAt: Date | null }) {
  return scanner.isOnline && !!scanner.lastHeartbeatAt && scanner.lastHeartbeatAt >= scannerOnlineSince();
}
