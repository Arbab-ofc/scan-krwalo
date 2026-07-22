import type { Prisma } from "@scan-krwalo/database";

export function audit(action: string, entityType: string, entityId?: string, metadata?: Prisma.InputJsonValue) {
  return {
    action,
    entityType,
    entityId,
    metadata
  };
}
