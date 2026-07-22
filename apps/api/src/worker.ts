import { Worker } from "bullmq";
import { prisma } from "@scan-krwalo/database";
import { queueConnection } from "./queues.js";
import { autoCompleteReview, expireUnclaimedTask } from "./services/tasks.service.js";
import { sendQueuedPushNotification } from "./services/push.service.js";

new Worker(
  "task-expiration",
  async (job) => {
    const taskId = job.data.taskId as string;
    if (job.name === "expire-unclaimed-task") {
      await expireUnclaimedTask(taskId);
    }
    if (job.name === "expire-incomplete-task") {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (task?.status === "CLAIMED" && task.completionExpiresAt && task.completionExpiresAt <= new Date()) {
        await prisma.task.update({ where: { id: taskId }, data: { status: "COMPLETION_EXPIRED", expiredAt: new Date() } });
        await prisma.taskEvent.create({ data: { taskId, eventType: "TASK_EXPIRED", previousStatus: "CLAIMED", newStatus: "COMPLETION_EXPIRED" } });
      }
    }
    if (job.name === "auto-complete-client-review") {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (task?.status === "SCANNER_SUBMITTED") {
        await autoCompleteReview(taskId);
      }
    }
  },
  { connection: queueConnection }
);

new Worker(
  "push-notifications",
  async (job) => {
    if (job.name !== "send-push-notification") return;
    await sendQueuedPushNotification(job.data.userId as string, job.data.payload as { title: string; body: string; url?: string; tag?: string });
  },
  { connection: queueConnection }
);
