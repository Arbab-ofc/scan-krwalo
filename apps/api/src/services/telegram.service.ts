import { randomBytes } from "node:crypto";
import { prisma } from "@scan-krwalo/database";
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
  return { unlinked: true };
}

export async function handleTelegramWebhook(update: TelegramUpdate) {
  const text = update.message?.text?.trim() ?? "";
  const chatId = update.message?.chat?.id;
  if (!chatId || !text.startsWith("/start")) return { handled: false };
  const [, token] = text.split(/\s+/, 2);
  if (!token) {
    await sendTelegramMessage(String(chatId), "Open Telegram from your Scan Krwalo scanner dashboard to link this bot.");
    return { handled: true };
  }
  const scanner = await prisma.scannerProfile.findUnique({
    where: { telegramLinkToken: token },
    include: { user: { select: { username: true, role: true, activationStatus: true, accountStatus: true } } }
  });
  if (!scanner || scanner.user.role !== "SCANNER" || scanner.user.activationStatus !== "ACTIVE" || scanner.user.accountStatus !== "ACTIVE") {
    await sendTelegramMessage(String(chatId), "This Telegram link is invalid or expired. Generate a new link from your scanner dashboard.");
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
  return { handled: true };
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
      ...(config.webhookSecret ? { secret_token: config.webhookSecret } : {})
    })
  });
  const body = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !body?.ok) {
    throw new DomainError("TELEGRAM_WEBHOOK_FAILED", body?.description ?? "Could not configure Telegram webhook.", 502);
  }
  return { configured: true, webhookUrl };
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
