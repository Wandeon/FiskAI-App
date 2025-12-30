-- CreateEnum
CREATE TYPE "ExportTargetSystem" AS ENUM ('SYNESIS', 'PANTHEON', 'MINIMAX');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED');

-- CreateTable
CREATE TABLE "ExportProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetSystem" "ExportTargetSystem" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "exportProfileId" TEXT NOT NULL,
    "chartOfAccountsId" TEXT NOT NULL,
    "externalAccountCode" TEXT NOT NULL,
    "externalAccountName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "exportProfileId" TEXT NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "fileName" TEXT,
    "controlSum" TEXT,
    "validationReport" JSONB,
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportProfile_companyId_idx" ON "ExportProfile"("companyId");

-- CreateIndex
CREATE INDEX "ExportProfile_companyId_targetSystem_idx" ON "ExportProfile"("companyId", "targetSystem");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMapping_exportProfileId_chartOfAccountsId_key" ON "AccountMapping"("exportProfileId", "chartOfAccountsId");

-- CreateIndex
CREATE INDEX "AccountMapping_companyId_idx" ON "AccountMapping"("companyId");

-- CreateIndex
CREATE INDEX "AccountMapping_chartOfAccountsId_idx" ON "AccountMapping"("chartOfAccountsId");

-- CreateIndex
CREATE INDEX "ExportJob_companyId_idx" ON "ExportJob"("companyId");

-- CreateIndex
CREATE INDEX "ExportJob_exportProfileId_idx" ON "ExportJob"("exportProfileId");

-- CreateIndex
CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");

-- AddForeignKey
ALTER TABLE "ExportProfile" ADD CONSTRAINT "ExportProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMapping" ADD CONSTRAINT "AccountMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMapping" ADD CONSTRAINT "AccountMapping_exportProfileId_fkey" FOREIGN KEY ("exportProfileId") REFERENCES "ExportProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMapping" ADD CONSTRAINT "AccountMapping_chartOfAccountsId_fkey" FOREIGN KEY ("chartOfAccountsId") REFERENCES "ChartOfAccounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_exportProfileId_fkey" FOREIGN KEY ("exportProfileId") REFERENCES "ExportProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
