ALTER TABLE "ScannerProfile"
ADD COLUMN "telegramChatId" TEXT,
ADD COLUMN "telegramUsername" TEXT,
ADD COLUMN "telegramLinkedAt" TIMESTAMP(3),
ADD COLUMN "telegramLinkToken" TEXT,
ADD COLUMN "telegramLinkTokenCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ScannerProfile_telegramChatId_key" ON "ScannerProfile"("telegramChatId");
CREATE UNIQUE INDEX "ScannerProfile_telegramLinkToken_key" ON "ScannerProfile"("telegramLinkToken");
