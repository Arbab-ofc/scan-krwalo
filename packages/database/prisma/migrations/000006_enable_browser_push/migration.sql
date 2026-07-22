INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
VALUES ('browserPushEnabled', 'true'::jsonb, NOW())
ON CONFLICT ("key") DO UPDATE
SET "value" = 'true'::jsonb,
    "updatedAt" = NOW()
WHERE "SystemSetting"."value" = 'false'::jsonb;
