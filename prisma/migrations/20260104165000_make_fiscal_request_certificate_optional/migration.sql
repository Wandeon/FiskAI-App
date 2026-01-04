-- AlterTable: Make certificateId optional on FiscalRequest
-- Allows recording cert-missing failures without a certificate reference

ALTER TABLE "FiscalRequest" ALTER COLUMN "certificateId" DROP NOT NULL;
