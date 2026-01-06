-- Add unique partial index on EInvoice for provider deduplication
-- Only enforces uniqueness where providerRef is NOT NULL
-- This prevents duplicate inbound invoices from the same provider

CREATE UNIQUE INDEX IF NOT EXISTS "EInvoice_companyId_providerRef_unique" 
ON "EInvoice" ("companyId", "providerRef") 
WHERE "providerRef" IS NOT NULL;

-- Also add an index on providerRef alone for faster lookups
CREATE INDEX IF NOT EXISTS "EInvoice_providerRef_idx" 
ON "EInvoice" ("providerRef") 
WHERE "providerRef" IS NOT NULL;
