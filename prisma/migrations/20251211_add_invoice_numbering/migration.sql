-- CreateTable
CREATE TABLE "BusinessPremises" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPremises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentDevice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "businessPremisesId" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "businessPremisesId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPremises_companyId_code_key" ON "BusinessPremises"("companyId", "code");

-- CreateIndex
CREATE INDEX "BusinessPremises_companyId_idx" ON "BusinessPremises"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentDevice_businessPremisesId_code_key" ON "PaymentDevice"("businessPremisesId", "code");

-- CreateIndex
CREATE INDEX "PaymentDevice_companyId_idx" ON "PaymentDevice"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_businessPremisesId_year_key" ON "InvoiceSequence"("businessPremisesId", "year");

-- CreateIndex
CREATE INDEX "InvoiceSequence_companyId_idx" ON "InvoiceSequence"("companyId");

-- AddForeignKey
ALTER TABLE "BusinessPremises" ADD CONSTRAINT "BusinessPremises_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDevice" ADD CONSTRAINT "PaymentDevice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDevice" ADD CONSTRAINT "PaymentDevice_businessPremisesId_fkey" FOREIGN KEY ("businessPremisesId") REFERENCES "BusinessPremises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_businessPremisesId_fkey" FOREIGN KEY ("businessPremisesId") REFERENCES "BusinessPremises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
