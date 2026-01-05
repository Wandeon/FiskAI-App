-- AlterTable: Add integrationAccountId to FiscalRequest
ALTER TABLE "FiscalRequest" ADD COLUMN IF NOT EXISTS "integrationAccountId" TEXT;

-- AddForeignKey
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FiscalRequest_integrationAccountId_fkey') THEN
    ALTER TABLE "FiscalRequest" ADD CONSTRAINT "FiscalRequest_integrationAccountId_fkey" 
    FOREIGN KEY ("integrationAccountId") REFERENCES "integration_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
