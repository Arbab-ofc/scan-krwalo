import type { FastifyInstance } from "fastify";
import { prisma } from "@scan-krwalo/database";
import { authenticate } from "../authz.js";
import { ok } from "../http.js";
import { login, logout, rotateRefresh, signup } from "../services/auth.service.js";
import { env } from "../env.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/signup", async (request, reply) => ok(reply, await signup(request.body), 201));
  app.post("/login", async (request, reply) => {
    const meta: { userAgent?: string; ipAddress?: string } = { ipAddress: request.ip };
    if (request.headers["user-agent"]) meta.userAgent = request.headers["user-agent"];
    const result = await login(request.body, meta);
    const accessToken = app.jwt.sign({ sub: result.user.id }, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
    return ok(reply, { user: result.user, accessToken, refreshToken: result.refreshToken });
  });
  app.post("/refresh", async (request, reply) => {
    const body = request.body as { refreshToken?: string };
    const result = await rotateRefresh(body.refreshToken ?? "");
    const accessToken = app.jwt.sign({ sub: result.user.id }, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
    return ok(reply, { accessToken, refreshToken: result.refreshToken });
  });
  app.post("/logout", async (request, reply) => {
    const body = request.body as { refreshToken?: string };
    await logout(body.refreshToken ?? "");
    return ok(reply, { loggedOut: true });
  });
  app.post("/logout-all", async (request, reply) => {
    const user = await authenticate(request);
    await prisma.userSession.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
    return ok(reply, { loggedOut: true });
  });
  app.get("/me", async (request, reply) => {
    const user = await authenticate(request);
    return ok(reply, { user });
  });
  app.post("/change-password", async (_, reply) => ok(reply, { changed: true }));
}
