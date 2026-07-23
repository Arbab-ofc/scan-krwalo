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
    const pushSubscription = toWebPushSubscription(subscription.endpoint, subscription.keys);
    if (!pushSubscription) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
      return;
    }
    try {
      await webPush.sendNotification(pushSubscription, JSON.stringify(payload));
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : null;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
      }
    }
  }));
}

export async function sendPushNotificationNow(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!pushConfigured) return { configured: false, attempted: 0, sent: 0, removed: 0, failed: 0, errors: [] as string[] };
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let removed = 0;
  let failed = 0;
  const errors: string[] = [];
  await Promise.all(subscriptions.map(async (subscription) => {
    const pushSubscription = toWebPushSubscription(subscription.endpoint, subscription.keys);
    if (!pushSubscription) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
      removed += 1;
      errors.push("Removed a malformed push subscription. Enable push notifications again on this device.");
      return;
    }
    try {
      await webPush.sendNotification(pushSubscription, JSON.stringify(payload));
      sent += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : null;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
        removed += 1;
        errors.push("Removed an expired push subscription. Enable push notifications again on this device.");
      } else {
        failed += 1;
        errors.push(pushErrorMessage(error));
      }
    }
  }));
  return { configured: true, attempted: subscriptions.length, sent, removed, failed, errors: [...new Set(errors)].slice(0, 3) };
}

function toWebPushSubscription(endpoint: string, keys: unknown): import("web-push").PushSubscription | null {
  if (!isRecord(keys)) return null;
  const p256dh = keys.p256dh;
  const auth = keys.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || !p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pushErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Push provider rejected the notification.";
}
