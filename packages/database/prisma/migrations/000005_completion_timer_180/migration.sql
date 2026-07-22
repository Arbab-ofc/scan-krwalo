INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
VALUES ('taskCompletionWindowSeconds', '180'::jsonb, NOW())
ON CONFLICT ("key") DO UPDATE
SET "value" = '180'::jsonb,
    "updatedAt" = NOW()
WHERE "SystemSetting"."value" = '150'::jsonb;
