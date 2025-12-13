-- Add barcode-related fields to EInvoice
ALTER TABLE "EInvoice"
  ADD COLUMN "bankAccount" TEXT,
  ADD COLUMN "includeBarcode" BOOLEAN NOT NULL DEFAULT true;
