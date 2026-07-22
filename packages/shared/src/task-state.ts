export const taskStatuses = [
  "DRAFT",
  "AVAILABLE",
  "CLAIMED",
  "SCANNER_SUBMITTED",
  "CLIENT_CONFIRMED",
  "COMPLETED",
  "CLAIM_EXPIRED",
  "COMPLETION_EXPIRED",
  "CLIENT_REVIEW_EXPIRED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED",
  "REJECTED",
  "AUTO_COMPLETED"
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

const allowed: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ["AVAILABLE", "CANCELLED"],
  AVAILABLE: ["CLAIMED", "CLAIM_EXPIRED", "CANCELLED"],
  CLAIMED: ["SCANNER_SUBMITTED", "COMPLETION_EXPIRED", "DISPUTED"],
  SCANNER_SUBMITTED: ["CLIENT_CONFIRMED", "DISPUTED", "AUTO_COMPLETED"],
  CLIENT_CONFIRMED: ["COMPLETED"],
  COMPLETED: [],
  CLAIM_EXPIRED: ["REFUNDED"],
  COMPLETION_EXPIRED: ["REFUNDED", "DISPUTED"],
  CLIENT_REVIEW_EXPIRED: ["AUTO_COMPLETED"],
  CANCELLED: ["REFUNDED"],
  DISPUTED: ["COMPLETED", "REFUNDED", "REJECTED"],
  REFUNDED: [],
  REJECTED: [],
  AUTO_COMPLETED: ["COMPLETED"]
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return allowed[from].includes(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTask(from, to)) {
    throw new Error(`Invalid task transition ${from} -> ${to}`);
  }
}
