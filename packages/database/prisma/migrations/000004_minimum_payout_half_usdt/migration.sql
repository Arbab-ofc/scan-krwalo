UPDATE "SystemSetting"
SET "value" = '"50"', "updatedAt" = NOW()
WHERE "key" = 'minimumPayoutAmount';
