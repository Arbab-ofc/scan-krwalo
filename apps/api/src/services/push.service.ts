import { env } from "../env.js";
import { pushNotificationsQueue } from "../queues.js";
import { getSettings } from "./settings.service.js";

type PushPayload = { title: string; body: string; url?: string; tag?: string };

const pushConfigured = Boolean(env.ONESIGNAL_APP_ID && env.ONESIGNAL_REST_API_KEY);

export function getPushConfig() {
  return {
    enabled: pushConfigured,
    provider: "onesignal",
    appId: env.ONESIGNAL_APP_ID || null
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
  await sendOneSignalPush([userId], payload);
}

export async function sendPushNotificationNow(userId: string, payload: PushPayload) {
  if (!pushConfigured) return { configured: false, attempted: 0, sent: 0, removed: 0, failed: 0, errors: [] as string[] };
  const result = await sendOneSignalPush([userId], payload);
  return {
    configured: true,
    attempted: 1,
    sent: result.sent ? 1 : 0,
    removed: 0,
    failed: result.sent ? 0 : 1,
    errors: result.sent ? [] : [result.error ?? "OneSignal did not accept the push notification."],
    provider: "onesignal",
    messageId: result.id ?? null,
    warnings: result.warnings ?? null
  };
}

export async function sendPushNotificationToUsers(userIds: string[], payload: PushPayload) {
  if (!pushConfigured) return { configured: false, attempted: userIds.length, sent: 0, failed: 0, errors: [] as string[], messageIds: [] as string[] };
  const batches = chunk(userIds, 20_000);
  const results = await Promise.all(batches.map((batch) => sendOneSignalPush(batch, payload)));
  const sent = results.reduce((total, result, index) => total + (result.sent ? (batches[index]?.length ?? 0) : 0), 0);
  const failed = results.reduce((total, result, index) => total + (!result.sent ? (batches[index]?.length ?? 0) : 0), 0);
  return {
    configured: true,
    attempted: userIds.length,
    sent,
    failed,
    errors: results.filter((result) => !result.sent).map((result) => result.error ?? "OneSignal did not accept the push notification.").slice(0, 5),
    messageIds: results.map((result) => result.id).filter((id): id is string => Boolean(id)),
    warnings: results.map((result) => result.warnings).filter(Boolean)
  };
}

async function sendOneSignalPush(externalUserIds: string[], payload: PushPayload) {
  if (!pushConfigured || externalUserIds.length === 0) return { sent: false, error: "OneSignal is not configured." };
  const response = await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Key ${env.ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: env.ONESIGNAL_APP_ID,
      target_channel: "push",
      include_aliases: { external_id: externalUserIds },
      headings: { en: payload.title },
      contents: { en: payload.body },
      url: absoluteUrl(payload.url),
      custom_data: { tag: payload.tag }
    })
  });
  const body = await response.json().catch(() => null) as { id?: string; errors?: unknown; warnings?: unknown } | null;
  if (!response.ok || !body?.id) {
    return { sent: false, error: oneSignalErrorMessage(response.status, body) };
  }
  return { sent: true, id: body.id, warnings: body.warnings };
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

function oneSignalErrorMessage(status: number, body: { errors?: unknown; warnings?: unknown } | null) {
  const detail = body?.errors ?? body?.warnings;
  if (typeof detail === "string") return `OneSignal error (${status}): ${detail}`;
  if (detail) return `OneSignal error (${status}): ${JSON.stringify(detail)}`;
  return `OneSignal error (${status}).`;
}
