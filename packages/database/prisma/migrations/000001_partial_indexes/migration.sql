-- Prisma cannot express partial unique indexes. This enforces one active claimed task per scanner.
CREATE UNIQUE INDEX IF NOT EXISTS "one_active_task_per_scanner"
ON "Task" ("assignedScannerId")
WHERE "assignedScannerId" IS NOT NULL
AND "status" IN ('CLAIMED', 'SCANNER_SUBMITTED', 'DISPUTED');
