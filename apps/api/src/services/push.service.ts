import { createRequire } from "node:module";
import { prisma } from "@scan-krwalo/database";
import { env } from "../env.js";
import { pushNotificationsQueue } from "../queues.js";
import { getSettings } from "./settings.service.js";

const require = createRequire(import.meta.url);
const webPush = require("web-push") as typeof import("web-push");
const pushConfigured = Boolean(env.PUSH_PUBLIC_KEY && env.PUSH_PRIVATE_KEY);

if (pushConfigured) {
  webPush.setVapidDetails(env.PUSH_SUBJECT, env.PUSH_PUBLIC_KEY, env.PUSH_PRIVATE_KEY);
}

export function getPushConfig() {
  return {
    enabled: pushConfigured,
    publicKey: pushConfigured ? env.PUSH_PUBLIC_KEY : null
  };
}

export async function enqueuePushNotification(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!pushConfigured) return;
  const settings = await getSettings();
  if (!settings.browserPushEnabled) return;
  const addJob = pushNotificationsQueue.add(
    "send-push-notification",
    { userId, payload },
    {
      jobId: `push:${userId}:${payload.tag ?? payload.title}:${Date.now()}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 }
    }
  ).catch((error) => console.error("Failed to enqueue push notification", { userId, error }));
  await Promise.race([
    addJob,
    new Promise((resolve) => setTimeout(resolve, 1000))
  ]);
}

export async function sendQueuedPushNotification(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!pushConfigured) return;
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys as { p256dh: string; auth: string }
        },
        JSON.stringify(payload)
      );
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : null;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
      }
    }
  }));
}

export async function sendPushNotificationNow(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!pushConfigured) return { configured: false, attempted: 0, sent: 0, removed: 0 };
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let removed = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys as { p256dh: string; auth: string }
        },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : null;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
        removed += 1;
      }
    }
  }));
  return { configured: true, attempted: subscriptions.length, sent, removed };
}
