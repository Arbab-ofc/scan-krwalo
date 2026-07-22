ALTER TABLE "ActivationCode" ADD COLUMN "fullCode" TEXT;
CREATE UNIQUE INDEX "ActivationCode_fullCode_key" ON "ActivationCode"("fullCode");
