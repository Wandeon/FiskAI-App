-- AlterTable: Add integrationAccountId to ProviderSyncState
ALTER TABLE "ProviderSyncState" ADD COLUMN "integrationAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "ProviderSyncState" ADD CONSTRAINT "ProviderSyncState_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "integration_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
