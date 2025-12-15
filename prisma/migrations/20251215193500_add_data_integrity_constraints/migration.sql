-- Add unique constraint for invoice numbers per company
-- Prevents duplicate invoice numbers within the same company (accounting/fiscalization requirement)
CREATE UNIQUE INDEX IF NOT EXISTS "EInvoice_companyId_invoiceNumber_key" ON "EInvoice"("companyId", "invoiceNumber");

-- Add unique constraint for contact OIB per company
-- Prevents duplicate contacts with same OIB within a company (NULL OIBs are allowed as duplicates per PostgreSQL behavior)
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_companyId_oib_key" ON "Contact"("companyId", "oib");

-- Add partial unique index for default company per user
-- Ensures only one company can be marked as default for each user
-- This prevents race conditions where concurrent requests could set multiple defaults
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyUser_userId_isDefault_unique" ON "CompanyUser"("userId") WHERE "isDefault" = true;
