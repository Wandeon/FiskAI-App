-- CreateIndex: Add index for integrationAccountId lookups on FiscalRequest
CREATE INDEX IF NOT EXISTS "FiscalRequest_integrationAccountId_idx" ON "FiscalRequest"("integrationAccountId");
