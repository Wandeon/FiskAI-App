-- Add certificate snapshot and QR payload fields to FiscalRequest
ALTER TABLE "FiscalRequest"
  ADD COLUMN "certificateSubject" TEXT,
  ADD COLUMN "certificateSerial" TEXT,
  ADD COLUMN "certificateNotBefore" TIMESTAMP(3),
  ADD COLUMN "certificateNotAfter" TIMESTAMP(3),
  ADD COLUMN "certificateSha256" TEXT,
  ADD COLUMN "certificateProvider" TEXT,
  ADD COLUMN "certificateOib" TEXT,
  ADD COLUMN "qrInvoiceNumber" TEXT,
  ADD COLUMN "qrIssuerOib" TEXT,
  ADD COLUMN "qrIssueDate" TIMESTAMP(3),
  ADD COLUMN "qrAmount" DECIMAL(10, 2);

-- Create enum for fiscal responses
DO $$ BEGIN
  CREATE TYPE "FiscalResponseStatus" AS ENUM ('SUCCESS', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create FiscalResponse table
CREATE TABLE "FiscalResponse" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "status" "FiscalResponseStatus" NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "jir" TEXT,
  "zki" TEXT,
  "responseXml" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "httpStatus" INTEGER,
  "qrJir" TEXT,
  "qrZki" TEXT,
  "qrVerificationUrl" TEXT,
  "qrDateTime" TIMESTAMP(3),
  "qrAmount" DECIMAL(10, 2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FiscalResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FiscalResponse_requestId_idx" ON "FiscalResponse"("requestId");
CREATE INDEX "FiscalResponse_status_idx" ON "FiscalResponse"("status");

ALTER TABLE "FiscalResponse"
  ADD CONSTRAINT "FiscalResponse_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "FiscalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
