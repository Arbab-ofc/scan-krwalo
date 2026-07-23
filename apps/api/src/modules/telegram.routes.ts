import type { FastifyInstance } from "fastify";
import { ok } from "../http.js";
import { getTelegramBotConfig, handleTelegramWebhook } from "../services/telegram.service.js";
import { DomainError } from "@scan-krwalo/shared";

export async function registerTelegramRoutes(app: FastifyInstance) {
  app.post("/webhook", async (request, reply) => {
    const config = await getTelegramBotConfig();
    if (config.webhookSecret) {
      const secret = request.headers["x-telegram-bot-api-secret-token"];
      if (secret !== config.webhookSecret) {
        throw new DomainError("FORBIDDEN", "Telegram webhook secret is invalid.", 403);
      }
    }
    return ok(reply, await handleTelegramWebhook(request.body as never));
  });
}
