import { Worker } from "bullmq";
import { prisma } from "@scan-krwalo/database";
import { queueConnection } from "./queues.js";
import { autoCompleteReview, expireIncompleteTask, expireUnclaimedTask } from "./services/tasks.service.js";
import { sendQueuedPushNotification } from "./services/push.service.js";

new Worker(
  "task-expiration",
  async (job) => {
    const taskId = job.data.taskId as string;
    if (job.name === "expire-unclaimed-task") {
      await expireUnclaimedTask(taskId);
    }
    if (job.name === "expire-incomplete-task") {
      await expireIncompleteTask(taskId);
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
