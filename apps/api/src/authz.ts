import type { FastifyRequest } from "fastify";
import { prisma, type UserRole } from "@scan-krwalo/database";
import { DomainError } from "@scan-krwalo/shared";

export type AuthUser = {
  id: string;
  role: UserRole;
  activationStatus: "INACTIVE" | "ACTIVE";
  accountStatus: "ACTIVE" | "SUSPENDED";
};

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export async function authenticate(request: FastifyRequest): Promise<AuthUser> {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw new DomainError("FORBIDDEN", "Authentication required.", 401);
  }
  let decoded: { sub: string };
  try {
    decoded = await request.jwtVerify<{ sub: string }>();
  } catch {
    throw new DomainError("FORBIDDEN", "Authentication required.", 401);
  }
  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, role: true, activationStatus: true, accountStatus: true }
  });
  if (!user) throw new DomainError("FORBIDDEN", "Authentication required.", 401);
  if (user.accountStatus === "SUSPENDED") throw new DomainError("ACCOUNT_SUSPENDED", "Account is suspended.", 403);
  request.authUser = user;
  return user;
}

export async function requireRole(request: FastifyRequest, roles: UserRole[]): Promise<AuthUser> {
  const user = request.authUser ?? await authenticate(request);
  if (!roles.includes(user.role)) throw new DomainError("FORBIDDEN", "You do not have permission for this action.", 403);
  return user;
}

export async function requireActivated(request: FastifyRequest): Promise<AuthUser> {
  const user = request.authUser ?? await authenticate(request);
  if (user.activationStatus !== "ACTIVE") throw new DomainError("FORBIDDEN", "Activate your profile first.", 403);
  return user;
}
