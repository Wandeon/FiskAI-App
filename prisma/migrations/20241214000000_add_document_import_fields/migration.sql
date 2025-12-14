-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BANK_STATEMENT', 'INVOICE', 'EXPENSE');

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'READY_FOR_REVIEW';
ALTER TYPE "JobStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "JobStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "ImportJob" ALTER COLUMN "bankAccountId" DROP NOT NULL;
ALTER TABLE "ImportJob" ADD COLUMN "documentType" "DocumentType";
ALTER TABLE "ImportJob" ADD COLUMN "extractedData" JSONB;
