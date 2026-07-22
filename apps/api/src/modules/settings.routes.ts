import type { FastifyInstance } from "fastify";
import { requireRole } from "../authz.js";
import { ok } from "../http.js";
import { getSettings, updateSettings } from "../services/settings.service.js";
import { telegramContactUrl } from "@scan-krwalo/shared";

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get("/settings/public", async (_, reply) => {
    const settings = await getSettings();
    return ok(reply, {
      platformName: settings.platformName,
      platformTagline: settings.platformTagline,
      telegramContactEnabled: settings.telegramContactEnabled,
      telegramUsername: settings.telegramUsername,
      telegramContactUrl: settings.telegramContactEnabled ? telegramContactUrl(settings.telegramUsername) : null
    });
  });
  app.get("/admin/settings", async (request, reply) => {
    await requireRole(request, ["ADMIN"]);
    return ok(reply, await getSettings());
  });
  app.patch("/admin/settings", async (request, reply) => {
    const user = await requireRole(request, ["ADMIN"]);
    return ok(reply, await updateSettings(request.body as Record<string, unknown>, user.id));
  });
}
