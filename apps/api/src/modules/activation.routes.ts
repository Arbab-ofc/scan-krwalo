import type { FastifyInstance } from "fastify";
import { authenticate } from "../authz.js";
import { ok } from "../http.js";
import { redeemActivationCode } from "../services/activation.service.js";
import { prisma } from "@scan-krwalo/database";

export async function registerActivationRoutes(app: FastifyInstance) {
  app.post("/redeem", async (request, reply) => {
    const user = await authenticate(request);
    const body = request.body as { code?: string };
    return ok(reply, await redeemActivationCode(user.id, body.code ?? ""));
  });
  app.get("/status", async (request, reply) => {
    const user = await authenticate(request);
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, activationStatus: true, scannerProfile: true, clientProfile: true }
    });
    return ok(reply, full);
  });
}
