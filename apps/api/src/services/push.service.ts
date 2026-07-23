import { env } from "../env.js";
import { pushNotificationsQueue } from "../queues.js";
import { getSettings } from "./settings.service.js";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@scan-krwalo/database";

type PushPayload = { title: string; body: string; url?: string; tag?: string };

const pushConfigured = Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_VAPID_PUBLIC_KEY);

function firebaseMessaging() {
  const app = getApps()[0] ?? initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
  return getMessaging(app);
}

export function getPushConfig() {
  return {
    enabled: pushConfigured,
    provider: "firebase",
    vapidKey: env.FIREBASE_VAPID_PUBLIC_KEY || null
  };
}

export async function enqueuePushNotification(userId: string, payload: PushPayload) {
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

export async function sendQueuedPushNotification(userId: string, payload: PushPayload) {
  await sendFirebasePush([userId], payload);
}

export async function sendPushNotificationNow(userId: string, payload: PushPayload) {
  if (!pushConfigured) return { configured: false, attempted: 0, sent: 0, removed: 0, failed: 0, errors: [] as string[] };
  const result = await sendFirebasePush([userId], payload);
  return {
    configured: true,
    attempted: 1,
    sent: result.sent ? 1 : 0,
    removed: 0,
    failed: result.sent ? 0 : 1,
    errors: result.sent ? [] : [result.error ?? "Firebase did not accept the push notification."],
    provider: "firebase",
    messageId: result.id ?? null
  };
}

export async function sendPushNotificationToUsers(userIds: string[], payload: PushPayload) {
  if (!pushConfigured) return { configured: false, attempted: userIds.length, sent: 0, failed: 0, errors: [] as string[], messageIds: [] as string[] };
  const batches = chunk(userIds, 500);
  const results = await Promise.all(batches.map((batch) => sendFirebasePush(batch, payload)));
  const sent = results.reduce((total, result) => total + result.delivered, 0);
  const failed = Math.max(0, results.reduce((total, result) => total + result.attempted, 0) - sent);
  return {
    configured: true,
    attempted: userIds.length,
    sent,
    failed,
    errors: results.filter((result) => !result.sent).map((result) => result.error ?? "Firebase did not accept the push notification.").slice(0, 5),
    messageIds: results.map((result) => result.id).filter((id): id is string => Boolean(id))
  };
}

async function sendFirebasePush(userIds: string[], payload: PushPayload) {
  if (!pushConfigured || userIds.length === 0) return { sent: false, delivered: 0, attempted: 0, error: "Firebase push is not configured." };
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true }
  });
  if (subscriptions.length === 0) return { sent: false, delivered: 0, attempted: 0, error: "No Firebase browser subscriptions are registered." };
  const tokenBatches = chunk(subscriptions, 500);
  const responses = await Promise.all(tokenBatches.map((batch) => firebaseMessaging().sendEachForMulticast({
    tokens: batch.map((subscription) => subscription.endpoint),
    notification: { title: payload.title, body: payload.body },
    data: { url: absoluteUrl(payload.url), tag: payload.tag ?? "scan-krwalo" },
    webpush: { fcmOptions: { link: absoluteUrl(payload.url) } }
  })));
  const invalidIds = responses.flatMap((response, batchIndex) => response.responses
    .map((result, index) => {
      const id = tokenBatches[batchIndex]?.[index]?.id;
      const code = result.error?.code;
      return id && (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") ? id : null;
    }))
    .filter((id): id is string => Boolean(id));
  if (invalidIds.length > 0) await prisma.pushSubscription.deleteMany({ where: { id: { in: invalidIds } } });
  const delivered = responses.reduce((total, response) => total + response.successCount, 0);
  const firstError = responses.flatMap((response) => response.responses).find((result) => !result.success)?.error?.message;
  if (delivered === 0) return { sent: false, delivered: 0, attempted: subscriptions.length, error: firstError ?? "Firebase did not deliver the push notification." };
  return { sent: true, delivered, attempted: subscriptions.length, id: `firebase:${Date.now()}` };
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function absoluteUrl(url?: string) {
  if (!url) return env.WEB_URL;
  if (/^https?:\/\//i.test(url)) return url;
  return `${env.WEB_URL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}
