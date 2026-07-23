import { prisma, type NotificationType } from "@scan-krwalo/database";
import { enqueuePushNotification } from "./push.service.js";
import { scannerOnlineSince } from "./presence.service.js";
import { sendTaskTelegramNotification } from "./telegram.service.js";

export async function notifyUser(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  payload?: unknown;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      payload: input.payload as object
    }
  });
}

export async function notifyEligibleOnlineScannersForTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return [];
  const scanners = await prisma.scannerProfile.findMany({
    where: {
      status: "ACTIVE",
      isOnline: true,
      lastHeartbeatAt: { gte: scannerOnlineSince() },
      user: { role: "SCANNER", activationStatus: "ACTIVE", accountStatus: "ACTIVE" },
      assignedTasks: { none: { status: { in: ["CLAIMED", "SCANNER_SUBMITTED", "DISPUTED"] } } }
    },
    select: { userId: true, telegramChatId: true }
  });
  if (scanners.length === 0) return [];
  const result = await prisma.notification.createMany({
    data: scanners.map((scanner) => ({
      userId: scanner.userId,
      type: "TASK_AVAILABLE",
      title: "New task available",
      message: `${task.publicId} is ready to grab.`,
      payload: { taskId: task.id, publicId: task.publicId }
    }))
  });
  await Promise.all(scanners.map((scanner) => enqueuePushNotification(scanner.userId, {
    title: "New task available",
    body: `${task.publicId} is ready to grab.`,
    url: "/scanner/live-tasks",
      tag: `task:${task.id}`
    })));
  const telegramScanners = await prisma.scannerProfile.findMany({
    where: {
      status: "ACTIVE",
      telegramChatId: { not: null },
      user: { role: "SCANNER", activationStatus: "ACTIVE", accountStatus: "ACTIVE" },
      assignedTasks: { none: { status: { in: ["CLAIMED", "SCANNER_SUBMITTED", "DISPUTED"] } } }
    },
    select: { userId: true, telegramChatId: true }
  });
  await Promise.all(telegramScanners
    .filter((scanner): scanner is { userId: string; telegramChatId: string } => Boolean(scanner.telegramChatId))
    .map((scanner) => sendTaskTelegramNotification({
      chatId: scanner.telegramChatId,
      publicId: task.publicId,
      title: task.title,
      normalizedUrl: task.normalizedUrl
    }).catch((error) => console.error("Failed to send Telegram task notification", { userId: scanner.userId, taskId, error }))));
  return result;
}
