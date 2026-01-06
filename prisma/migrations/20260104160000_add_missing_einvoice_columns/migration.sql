-- AddColumn: paidAmount and paymentStatus to EInvoice
-- These columns were in schema but missing from database

-- Create enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoicePaymentStatus') THEN
        CREATE TYPE "InvoicePaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
    END IF;
END $$;

-- Add columns if not exist
ALTER TABLE "EInvoice" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(12,2) DEFAULT 0 NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='EInvoice' AND column_name='paymentStatus') THEN
        ALTER TABLE "EInvoice" ADD COLUMN "paymentStatus" "InvoicePaymentStatus" DEFAULT 'UNPAID' NOT NULL;
    END IF;
END $$;
