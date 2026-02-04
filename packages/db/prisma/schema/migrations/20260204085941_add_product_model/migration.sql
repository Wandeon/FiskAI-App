-- CreateEnum
CREATE TYPE "LegalForm" AS ENUM ('OBRT_PAUSAL', 'OBRT_REAL', 'DOO', 'JDOO');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MANUAL', 'OCR_OBRTNICA', 'OCR_SUDSKO', 'VIES', 'SUDSKI_REGISTAR');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "acceptsCash" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "featureFlags" JSONB,
ADD COLUMN     "fiscalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "isVatPayer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legalForm" "LegalForm" NOT NULL DEFAULT 'OBRT_PAUSAL',
ADD COLUMN     "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "vatNumber" TEXT;

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PCE',
    "vatRate" INTEGER NOT NULL DEFAULT 25,
    "vatCategory" TEXT NOT NULL DEFAULT 'S',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_companyId_idx" ON "products"("companyId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
