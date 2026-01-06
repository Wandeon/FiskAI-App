-- CreateTable
CREATE TABLE "ProviderSyncState" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "direction" "EInvoiceDirection" NOT NULL,
    "lastSuccessfulPollAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderSyncState_companyId_idx" ON "ProviderSyncState"("companyId");

-- CreateIndex
CREATE INDEX "ProviderSyncState_provider_direction_idx" ON "ProviderSyncState"("provider", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSyncState_companyId_provider_direction_key" ON "ProviderSyncState"("companyId", "provider", "direction");

-- AddForeignKey
ALTER TABLE "ProviderSyncState" ADD CONSTRAINT "ProviderSyncState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
