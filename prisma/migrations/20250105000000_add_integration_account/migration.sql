-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('EINVOICE_EPOSLOVANJE', 'EINVOICE_FINA', 'EINVOICE_IE_RACUNI', 'FISCALIZATION_CIS');

-- CreateEnum
CREATE TYPE "IntegrationEnv" AS ENUM ('TEST', 'PROD');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "integration_account" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "environment" "IntegrationEnv" NOT NULL DEFAULT 'PROD',
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerConfig" JSONB,
    "secretEnvelope" TEXT,
    "secretKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "integration_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_account_company_idx" ON "integration_account"("companyId");

-- CreateIndex
CREATE INDEX "integration_account_status_idx" ON "integration_account"("status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_account_company_kind_env_key" ON "integration_account"("companyId", "kind", "environment");

-- AddForeignKey
ALTER TABLE "integration_account" ADD CONSTRAINT "integration_account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
