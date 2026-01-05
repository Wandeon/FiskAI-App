-- Add integrationAccountId to EInvoice for Phase 2 Multi-Tenant Integration
ALTER TABLE "EInvoice" ADD COLUMN "integrationAccountId" TEXT;

-- Add foreign key constraint to integration_account table
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_integrationAccountId_fkey"
  FOREIGN KEY ("integrationAccountId") REFERENCES "integration_account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for efficient lookups
CREATE INDEX "EInvoice_integrationAccountId_idx" ON "EInvoice"("integrationAccountId");
