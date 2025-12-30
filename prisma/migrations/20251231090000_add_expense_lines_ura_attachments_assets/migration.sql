-- CreateEnum
CREATE TYPE "AttachmentSource" AS ENUM ('UPLOAD', 'EMAIL', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FixedAssetCandidateStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "ExpenseLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "vatAmount" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UraInput" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "expenseLineId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vendorName" TEXT,
    "vendorVatNumber" TEXT,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "vatAmount" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "deductibleVatAmount" DECIMAL(10,2) NOT NULL,
    "nonDeductibleVatAmount" DECIMAL(10,2) NOT NULL,
    "ruleReferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UraInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "expenseId" TEXT,
    "expenseLineId" TEXT,
    "uraInputId" TEXT,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "sourceType" "AttachmentSource" NOT NULL DEFAULT 'UPLOAD',
    "sourceExternalId" TEXT,
    "isSourceImmutable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCorrection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAssetCandidate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "expenseLineId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "thresholdValue" DECIMAL(10,2) NOT NULL,
    "status" "FixedAssetCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "FixedAssetCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseLine_companyId_idx" ON "ExpenseLine"("companyId");

-- CreateIndex
CREATE INDEX "ExpenseLine_expenseId_idx" ON "ExpenseLine"("expenseId");

-- CreateIndex
CREATE INDEX "UraInput_companyId_idx" ON "UraInput"("companyId");

-- CreateIndex
CREATE INDEX "UraInput_expenseId_idx" ON "UraInput"("expenseId");

-- CreateIndex
CREATE INDEX "UraInput_expenseLineId_idx" ON "UraInput"("expenseLineId");

-- CreateIndex
CREATE INDEX "Attachment_companyId_idx" ON "Attachment"("companyId");

-- CreateIndex
CREATE INDEX "Attachment_expenseId_idx" ON "Attachment"("expenseId");

-- CreateIndex
CREATE INDEX "Attachment_expenseLineId_idx" ON "Attachment"("expenseLineId");

-- CreateIndex
CREATE INDEX "Attachment_uraInputId_idx" ON "Attachment"("uraInputId");

-- CreateIndex
CREATE INDEX "ExpenseCorrection_companyId_idx" ON "ExpenseCorrection"("companyId");

-- CreateIndex
CREATE INDEX "ExpenseCorrection_expenseId_idx" ON "ExpenseCorrection"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetCandidate_expenseLineId_key" ON "FixedAssetCandidate"("expenseLineId");

-- CreateIndex
CREATE INDEX "FixedAssetCandidate_companyId_idx" ON "FixedAssetCandidate"("companyId");

-- CreateIndex
CREATE INDEX "FixedAssetCandidate_expenseId_idx" ON "FixedAssetCandidate"("expenseId");

-- AddForeignKey
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UraInput" ADD CONSTRAINT "UraInput_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UraInput" ADD CONSTRAINT "UraInput_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UraInput" ADD CONSTRAINT "UraInput_expenseLineId_fkey" FOREIGN KEY ("expenseLineId") REFERENCES "ExpenseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_expenseLineId_fkey" FOREIGN KEY ("expenseLineId") REFERENCES "ExpenseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uraInputId_fkey" FOREIGN KEY ("uraInputId") REFERENCES "UraInput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCorrection" ADD CONSTRAINT "ExpenseCorrection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCorrection" ADD CONSTRAINT "ExpenseCorrection_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCandidate" ADD CONSTRAINT "FixedAssetCandidate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCandidate" ADD CONSTRAINT "FixedAssetCandidate_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCandidate" ADD CONSTRAINT "FixedAssetCandidate_expenseLineId_fkey" FOREIGN KEY ("expenseLineId") REFERENCES "ExpenseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
