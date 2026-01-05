-- CreateIndex: Add index for integrationAccountId lookups
CREATE INDEX IF NOT EXISTS "ProviderSyncState_integrationAccountId_idx" ON "ProviderSyncState"("integrationAccountId");
