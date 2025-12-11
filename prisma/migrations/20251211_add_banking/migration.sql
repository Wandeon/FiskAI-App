-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UNMATCHED', 'AUTO_MATCHED', 'MANUAL_MATCHED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ImportFormat" AS ENUM ('CSV', 'XML_CAMT053', 'MT940');

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "currentBalance" DECIMAL(12,2) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "counterpartyName" TEXT,
    "counterpartyIban" TEXT,
    "matchedInvoiceId" TEXT,
    "matchedExpenseId" TEXT,
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedAt" TIMESTAMP(3),
    "matchedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankImport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" "ImportFormat" NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" TEXT NOT NULL,

    CONSTRAINT "BankImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_companyId_iban_key" ON "BankAccount"("companyId", "iban");
CREATE INDEX "BankAccount_companyId_idx" ON "BankAccount"("companyId");

-- CreateIndex
CREATE INDEX "BankTransaction_companyId_idx" ON "BankTransaction"("companyId");
CREATE INDEX "BankTransaction_bankAccountId_idx" ON "BankTransaction"("bankAccountId");
CREATE INDEX "BankTransaction_matchStatus_idx" ON "BankTransaction"("matchStatus");
CREATE INDEX "BankTransaction_date_idx" ON "BankTransaction"("date");

-- CreateIndex
CREATE INDEX "BankImport_companyId_idx" ON "BankImport"("companyId");
CREATE INDEX "BankImport_bankAccountId_idx" ON "BankImport"("bankAccountId");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedInvoiceId_fkey" FOREIGN KEY ("matchedInvoiceId") REFERENCES "EInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedExpenseId_fkey" FOREIGN KEY ("matchedExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankImport" ADD CONSTRAINT "BankImport_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
