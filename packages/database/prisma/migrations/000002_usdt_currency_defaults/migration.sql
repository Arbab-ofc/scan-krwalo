ALTER TABLE "Task" ALTER COLUMN "rewardCurrency" SET DEFAULT 'USDT';
ALTER TABLE "ScannerWallet" ALTER COLUMN "currency" SET DEFAULT 'USDT';

UPDATE "SystemSetting"
SET "value" = '"USDT"', "updatedAt" = NOW()
WHERE "key" = 'rewardCurrency';

UPDATE "SystemSetting"
SET "value" = '"1000"', "updatedAt" = NOW()
WHERE "key" = 'minimumPayoutAmount';

UPDATE "ScannerWallet"
SET "currency" = 'USDT'
WHERE "currency" = 'INR';

UPDATE "Task"
SET "rewardCurrency" = 'USDT'
WHERE "rewardCurrency" = 'INR' AND "status" IN ('DRAFT', 'AVAILABLE');
