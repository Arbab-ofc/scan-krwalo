import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const queueConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
queueConnection.on("error", (error) => console.error("Redis queue connection error", error));

export const taskExpirationQueue = new Queue("task-expiration", { connection: queueConnection });
export const notificationsQueue = new Queue("notifications", { connection: queueConnection });
export const pushNotificationsQueue = new Queue("push-notifications", { connection: queueConnection });
export const maintenanceQueue = new Queue("maintenance", { connection: queueConnection });

export async function scheduleClaimExpiry(taskId: string, delayMs: number) {
  await queueSideEffect(taskExpirationQueue.add("expire-unclaimed-task", { taskId }, { jobId: `expire-unclaimed:${taskId}`, delay: delayMs, attempts: 3, backoff: { type: "exponential", delay: 1000 } }), "Failed to schedule claim expiry", taskId);
}

export async function scheduleCompletionExpiry(taskId: string, delayMs: number) {
  await queueSideEffect(taskExpirationQueue.add("expire-incomplete-task", { taskId }, { jobId: `expire-incomplete:${taskId}`, delay: delayMs, attempts: 3, backoff: { type: "exponential", delay: 1000 } }), "Failed to schedule completion expiry", taskId);
}

export async function scheduleClientReviewExpiry(taskId: string, delayMs: number) {
  await queueSideEffect(taskExpirationQueue.add("auto-complete-client-review", { taskId }, { jobId: `auto-complete-review:${taskId}`, delay: delayMs, attempts: 3, backoff: { type: "exponential", delay: 1000 } }), "Failed to schedule client review expiry", taskId);
}

async function queueSideEffect(promise: Promise<unknown>, message: string, taskId: string) {
  const guarded = promise.catch((error) => console.error(message, { taskId, error }));
  await Promise.race([
    guarded,
    new Promise((resolve) => setTimeout(resolve, 1000))
  ]);
}
