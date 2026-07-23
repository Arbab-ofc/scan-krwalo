import { randomBytes } from "node:crypto";
import { prisma, Prisma } from "@scan-krwalo/database";
import { DomainError } from "@scan-krwalo/shared";
import { env } from "../env.js";
import { getSettings } from "./settings.service.js";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    from?: { username?: string };
    text?: string;
  };
};

export async function getTelegramBotConfig() {
  const settings = await getSettings();
  const token = settings.telegramBotToken || env.TELEGRAM_BOT_TOKEN;
  const username = (settings.telegramBotUsername || env.TELEGRAM_BOT_USERNAME).replace(/^@+/, "");
  const webhookSecret = settings.telegramWebhookSecret || env.TELEGRAM_WEBHOOK_SECRET;
  return {
    enabled: Boolean(token && username),
    token,
    username: username || null,
    webhookSecret
  };
}

export async function createScannerTelegramLink(userId: string) {
  const scanner = await prisma.scannerProfile.findUnique({ where: { userId } });
  if (!scanner) throw new DomainError("FORBIDDEN", "Scanner profile required.", 403);
  const config = await getTelegramBotConfig();
  if (!config.enabled || !config.username) {
    return {
      enabled: false,
      linked: Boolean(scanner.telegramChatId),
      username: config.username,
      deepLink: null
    };
  }
  const token = randomBytes(24).toString("base64url");
  const updated = await prisma.scannerProfile.update({
    where: { id: scanner.id },
    data: { telegramLinkToken: token, telegramLinkTokenCreatedAt: new Date() }
  });
  return {
    enabled: true,
    linked: Boolean(updated.telegramChatId),
    username: config.username,
    deepLink: `https://t.me/${config.username}?start=${token}`,
    linkedAt: updated.telegramLinkedAt
  };
}

export async function getScannerTelegramStatus(userId: string) {
  const scanner = await prisma.scannerProfile.findUnique({ where: { userId } });
  if (!scanner) throw new DomainError("FORBIDDEN", "Scanner profile required.", 403);
  const config = await getTelegramBotConfig();
  return {
    enabled: config.enabled,
    username: config.username,
    linked: Boolean(scanner.telegramChatId),
    telegramUsername: scanner.telegramUsername,
    linkedAt: scanner.telegramLinkedAt
  };
}

export async function unlinkScannerTelegram(userId: string) {
  const scanner = await prisma.scannerProfile.findUnique({ where: { userId } });
  if (!scanner) throw new DomainError("FORBIDDEN", "Scanner profile required.", 403);
  await prisma.scannerProfile.update({
    where: { id: scanner.id },
    data: {
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
      telegramLinkToken: null,
      telegramLinkTokenCreatedAt: null
    }
  });
  await recordTelegramWebhookEvent("unlinked", { scannerId: scanner.id, userId });
  return { ...await getScannerTelegramStatus(userId), unlinked: true };
}

export async function handleTelegramWebhook(update: TelegramUpdate) {
  const text = update.message?.text?.trim() ?? "";
  const chatId = update.message?.chat?.id;
  if (!chatId || !text.startsWith("/start")) {
    await recordTelegramWebhookEvent("ignored_update", { hasChatId: Boolean(chatId), textPreview: text.slice(0, 24) });
    return { handled: false };
  }
  await recordTelegramWebhookEvent("start_received", { chatId: String(chatId), textPreview: text.slice(0, 24) });
  const [, token] = text.split(/\s+/, 2);
  if (!token) {
    await sendTelegramMessage(String(chatId), "Open Telegram from your Scan Krwalo scanner dashboard to link this bot.");
    await recordTelegramWebhookEvent("missing_token", { chatId: String(chatId) });
    return { handled: true };
  }
  const scanner = await prisma.scannerProfile.findUnique({
    where: { telegramLinkToken: token },
    include: { user: { select: { username: true, role: true, activationStatus: true, accountStatus: true } } }
  });
  if (!scanner || scanner.user.role !== "SCANNER" || scanner.user.activationStatus !== "ACTIVE" || scanner.user.accountStatus !== "ACTIVE") {
    await sendTelegramMessage(String(chatId), "This Telegram link is invalid or expired. Generate a new link from your scanner dashboard.");
    await recordTelegramWebhookEvent("invalid_token", { chatId: String(chatId), tokenPreview: token.slice(0, 8) });
    return { handled: true };
  }
  const chatIdValue = String(chatId);
  await prisma.$transaction(async (tx) => {
    await tx.scannerProfile.updateMany({
      where: { telegramChatId: chatIdValue, id: { not: scanner.id } },
      data: { telegramChatId: null, telegramUsername: null, telegramLinkedAt: null }
    });
    await tx.scannerProfile.update({
      where: { id: scanner.id },
      data: {
        telegramChatId: chatIdValue,
        telegramUsername: update.message?.from?.username ?? null,
        telegramLinkedAt: new Date(),
        telegramLinkToken: null,
        telegramLinkTokenCreatedAt: null
      }
    });
  });
  await sendTelegramMessage(String(chatId), `Telegram alerts are linked for ${scanner.user.username}. New live tasks will appear here.`);
  await recordTelegramWebhookEvent("linked", { chatId: chatIdValue, scannerId: scanner.id, username: scanner.user.username });
  return { handled: true, linked: true };
}

export async function configureTelegramWebhook() {
  const config = await getTelegramBotConfig();
  if (!config.token || !config.username) {
    throw new DomainError("TELEGRAM_NOT_CONFIGURED", "Telegram bot token and username are required.", 400);
  }
  const webhookUrl = `${env.API_URL.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "")}/api/v1/telegram/webhook`;
  const response = await fetch(`https://api.telegram.org/bot${config.token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
      ...(config.webhookSecret ? { secret_token: config.webhookSecret } : {})
    })
  });
  const body = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !body?.ok) {
    throw new DomainError("TELEGRAM_WEBHOOK_FAILED", body?.description ?? "Could not configure Telegram webhook.", 502);
  }
  return { configured: true, webhookUrl };
}

export async function getTelegramWebhookInfo() {
  const config = await getTelegramBotConfig();
  if (!config.token || !config.username) {
    throw new DomainError("TELEGRAM_NOT_CONFIGURED", "Telegram bot token and username are required.", 400);
  }
  const response = await fetch(`https://api.telegram.org/bot${config.token}/getWebhookInfo`);
  const body = await response.json().catch(() => null) as {
    ok?: boolean;
    result?: {
      url?: string;
      has_custom_certificate?: boolean;
      pending_update_count?: number;
      last_error_date?: number;
      last_error_message?: string;
      max_connections?: number;
      allowed_updates?: string[];
    };
    description?: string;
  } | null;
  if (!response.ok || !body?.ok) {
    throw new DomainError("TELEGRAM_WEBHOOK_FAILED", body?.description ?? "Could not read Telegram webhook info.", 502);
  }
  return {
    configured: Boolean(body.result?.url),
    url: body.result?.url ?? "",
    pendingUpdateCount: body.result?.pending_update_count ?? 0,
    lastErrorDate: body.result?.last_error_date ? new Date(body.result.last_error_date * 1000).toISOString() : null,
    lastErrorMessage: body.result?.last_error_message ?? null,
    allowedUpdates: body.result?.allowed_updates ?? [],
    recentEvents: await getRecentTelegramWebhookEvents(),
    recentTaskNotifications: await getRecentTaskNotificationEvents()
  };
}

export async function sendTaskTelegramNotification(input: {
  chatId: string;
  publicId: string;
  title?: string | null;
  normalizedUrl: string;
}) {
  const taskUrl = `${env.WEB_URL.replace(/\/$/, "")}/scanner/live-tasks`;
  const title = input.title ? `\n${input.title}` : "";
  await sendTelegramMessage(
    input.chatId,
    `New task available\n${input.publicId}${title}\n${input.normalizedUrl}\n\nOpen live tasks, go online if needed, and grab it before the timer ends.`,
    {
      inline_keyboard: [[{ text: "Open live tasks", url: taskUrl }]]
    }
  );
}

async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: unknown) {
  const config = await getTelegramBotConfig();
  if (!config.token) return;
  const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed (${response.status}): ${body}`);
  }
}

export async function recordTelegramWebhookEvent(event: string, metadata: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      action: `TELEGRAM_WEBHOOK_${event.toUpperCase()}`,
      entityType: "TelegramWebhook",
      metadata: metadata as Prisma.InputJsonObject
    }
  }).catch((error) => console.error("Failed to record Telegram webhook event", { event, error }));
}

async function getRecentTelegramWebhookEvents() {
  const rows = await prisma.auditLog.findMany({
    where: { entityType: "TelegramWebhook" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { action: true, metadata: true, createdAt: true }
  });
  return rows.map((row) => ({
    action: row.action,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString()
  }));
}

async function getRecentTaskNotificationEvents() {
  const rows = await prisma.auditLog.findMany({
    where: { action: "TASK_NOTIFICATIONS_SENT" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { entityId: true, metadata: true, createdAt: true }
  });
  return rows.map((row) => ({
    taskId: row.entityId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString()
  }));
}
