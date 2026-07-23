import { prisma, type NotificationType } from "@scan-krwalo/database";
import { enqueuePushNotification } from "./push.service.js";
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
      user: { role: "SCANNER", activationStatus: "ACTIVE", accountStatus: "ACTIVE" }
    },
    select: { userId: true, telegramChatId: true }
  });
  const result = scanners.length > 0 ? await prisma.notification.createMany({
    data: scanners.map((scanner) => ({
      userId: scanner.userId,
      type: "TASK_AVAILABLE",
      title: "New task available",
      message: `${task.publicId} is ready to grab.`,
      payload: { taskId: task.id, publicId: task.publicId }
    }))
  }) : { count: 0 };
  await Promise.all(scanners.map((scanner) => enqueuePushNotification(scanner.userId, {
    title: "New task available",
    body: `${task.publicId} is ready to grab.`,
    url: "/scanner/live-tasks",
    tag: `task:${task.id}`
  })));
  const telegramResults = await Promise.all(scanners
    .filter((scanner): scanner is { userId: string; telegramChatId: string } => Boolean(scanner.telegramChatId))
    .map(async (scanner) => {
      try {
        await sendTaskTelegramNotification({
          chatId: scanner.telegramChatId,
          publicId: task.publicId,
          title: task.title,
          normalizedUrl: task.normalizedUrl
        });
        return { userId: scanner.userId, sent: true };
      } catch (error) {
        console.error("Failed to send Telegram task notification", { userId: scanner.userId, taskId, error });
        return { userId: scanner.userId, sent: false, error: error instanceof Error ? error.message : "Unknown Telegram error" };
      }
    }));
  await prisma.auditLog.create({
    data: {
      action: "TASK_NOTIFICATIONS_SENT",
      entityType: "Task",
      entityId: task.id,
      metadata: {
        scannerCount: scanners.length,
        telegramCount: scanners.filter((scanner) => scanner.telegramChatId).length,
        telegramSentCount: telegramResults.filter((result) => result.sent).length,
        telegramFailed: telegramResults.filter((result) => !result.sent).slice(0, 5)
      }
    }
  });
  return result;
}
