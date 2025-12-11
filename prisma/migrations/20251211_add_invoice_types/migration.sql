-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('INVOICE', 'E_INVOICE', 'QUOTE', 'PROFORMA', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- AlterTable: Add new columns to EInvoice
ALTER TABLE "EInvoice" ADD COLUMN "type" "InvoiceType" NOT NULL DEFAULT 'E_INVOICE';
ALTER TABLE "EInvoice" ADD COLUMN "internalReference" TEXT;
ALTER TABLE "EInvoice" ADD COLUMN "notes" TEXT;
ALTER TABLE "EInvoice" ADD COLUMN "convertedFromId" TEXT;

-- CreateIndex
CREATE INDEX "EInvoice_type_idx" ON "EInvoice"("type");

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_convertedFromId_fkey" FOREIGN KEY ("convertedFromId") REFERENCES "EInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
