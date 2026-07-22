import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";
import { Prisma, prisma } from "@scan-krwalo/database";
import { DomainError, signupSchema, loginSchema } from "@scan-krwalo/shared";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function signup(input: unknown) {
  const data = signupSchema.parse(input);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username }] }
  });
  if (existing) throw new DomainError("FORBIDDEN", "Username or email already exists.", 409);
  if (data.role === "ADMIN" && data.adminSecret !== process.env.ADMIN_SEED_PASSWORD) {
    throw new DomainError("FORBIDDEN", "Admin signup secret is invalid.", 403);
  }

  const passwordHash = await hash(data.password);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const storedRole = data.role === "SCANNER" ? "USER" : data.role;
      const activationStatus = data.role === "SCANNER" ? "INACTIVE" : "ACTIVE";
      const created = await tx.user.create({
        data: {
          username: data.username,
          email: data.email,
          passwordHash,
          role: storedRole,
          activationStatus
        },
        select: { id: true, username: true, email: true, role: true, activationStatus: true }
      });

      if (data.role === "CLIENT") {
        await tx.clientProfile.create({
          data: {
            userId: created.id,
            creditAccount: { create: {} }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: created.id,
          actorRole: created.role,
          action: "USER_SIGNED_UP",
          entityType: "User",
          entityId: created.id,
          metadata: { selectedRole: data.role, storedRole: created.role, activationStatus: created.activationStatus }
        }
      });

      return created;
    }, { maxWait: 10_000, timeout: 20_000 });
    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError("FORBIDDEN", "Username or email already exists.", 409);
    }
    throw error;
  }
}

export async function login(input: unknown, meta: { userAgent?: string; ipAddress?: string }) {
  const data = loginSchema.parse(input);
  const identifier = data.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: data.identifier }] }
  });
  if (!user || !(await verify(user.passwordHash, data.password))) {
    throw new DomainError("AUTH_INVALID_CREDENTIALS", "Invalid credentials.", 401);
  }
  if (user.accountStatus === "SUSPENDED") throw new DomainError("ACCOUNT_SUSPENDED", "Account is suspended.", 403);
  const refreshToken = randomBytes(48).toString("base64url");
  await prisma.userSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });
  return {
    user: { id: user.id, username: user.username, email: user.email, role: user.role, activationStatus: user.activationStatus },
    refreshToken
  };
}

export async function rotateRefresh(refreshToken: string) {
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true }
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new DomainError("FORBIDDEN", "Refresh session is invalid.", 401);
  }
  const nextToken = randomBytes(48).toString("base64url");
  await prisma.userSession.update({
    where: { id: session.id },
    data: { tokenHash: hashToken(nextToken), rotatedAt: new Date() }
  });
  return {
    user: session.user,
    refreshToken: nextToken
  };
}

export async function logout(refreshToken: string) {
  await prisma.userSession.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
