-- AlterTable
ALTER TABLE "User" ADD COLUMN "intendedBusinessType" TEXT;

-- Add comment
COMMENT ON COLUMN "User"."intendedBusinessType" IS 'Business type selected during registration (OBRT_PAUSAL, OBRT_REAL, OBRT_VAT, JDOO, DOO)';
