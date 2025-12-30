-- CreateEnum: TravelOrderStatus
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TravelOrderStatus') THEN
        CREATE TYPE "TravelOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED');
    END IF;
END $$;

-- CreateEnum: TravelVehicleType
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TravelVehicleType') THEN
        CREATE TYPE "TravelVehicleType" AS ENUM ('COMPANY_CAR', 'PRIVATE_CAR', 'PUBLIC_TRANSPORT', 'PLANE', 'OTHER');
    END IF;
END $$;

-- CreateEnum: MileageLogSource
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MileageLogSource') THEN
        CREATE TYPE "MileageLogSource" AS ENUM ('MANUAL', 'IMPORTED', 'DEVICE');
    END IF;
END $$;

-- CreateTable: TravelOrder
CREATE TABLE IF NOT EXISTS "TravelOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "travelerUserId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "origin" TEXT,
    "destination" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "vehicleType" "TravelVehicleType" NOT NULL,
    "distanceKm" DECIMAL(10,2),
    "perDiemDays" DECIMAL(8,2),
    "perDiemRate" DECIMAL(10,2),
    "perDiemAmount" DECIMAL(12,2),
    "mileageRate" DECIMAL(10,2),
    "mileageAmount" DECIMAL(12,2),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "perDiemRuleVersionId" TEXT,
    "mileageRuleVersionId" TEXT,
    "status" "TravelOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: TravelOrder indexes
CREATE UNIQUE INDEX IF NOT EXISTS "TravelOrder_companyId_orderNumber_key" ON "TravelOrder"("companyId", "orderNumber");
CREATE INDEX IF NOT EXISTS "TravelOrder_companyId_idx" ON "TravelOrder"("companyId");
CREATE INDEX IF NOT EXISTS "TravelOrder_travelerUserId_idx" ON "TravelOrder"("travelerUserId");
CREATE INDEX IF NOT EXISTS "TravelOrder_status_idx" ON "TravelOrder"("status");
CREATE INDEX IF NOT EXISTS "TravelOrder_departureDate_idx" ON "TravelOrder"("departureDate");
CREATE INDEX IF NOT EXISTS "TravelOrder_returnDate_idx" ON "TravelOrder"("returnDate");

-- AddForeignKey: TravelOrder relations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelOrder_companyId_fkey'
    ) THEN
        ALTER TABLE "TravelOrder" ADD CONSTRAINT "TravelOrder_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelOrder_travelerUserId_fkey'
    ) THEN
        ALTER TABLE "TravelOrder" ADD CONSTRAINT "TravelOrder_travelerUserId_fkey"
        FOREIGN KEY ("travelerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelOrder_perDiemRuleVersionId_fkey'
    ) THEN
        ALTER TABLE "TravelOrder" ADD CONSTRAINT "TravelOrder_perDiemRuleVersionId_fkey"
        FOREIGN KEY ("perDiemRuleVersionId") REFERENCES "RegulatoryRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelOrder_mileageRuleVersionId_fkey'
    ) THEN
        ALTER TABLE "TravelOrder" ADD CONSTRAINT "TravelOrder_mileageRuleVersionId_fkey"
        FOREIGN KEY ("mileageRuleVersionId") REFERENCES "RegulatoryRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: MileageLog
CREATE TABLE IF NOT EXISTS "MileageLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "travelOrderId" TEXT,
    "travelerUserId" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL,
    "origin" TEXT,
    "destination" TEXT,
    "purpose" TEXT NOT NULL,
    "startOdometer" DECIMAL(12,2),
    "endOdometer" DECIMAL(12,2),
    "distanceKm" DECIMAL(10,2) NOT NULL,
    "vehicleType" "TravelVehicleType" NOT NULL,
    "source" "MileageLogSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MileageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: MileageLog indexes
CREATE INDEX IF NOT EXISTS "MileageLog_companyId_idx" ON "MileageLog"("companyId");
CREATE INDEX IF NOT EXISTS "MileageLog_travelOrderId_idx" ON "MileageLog"("travelOrderId");
CREATE INDEX IF NOT EXISTS "MileageLog_travelerUserId_idx" ON "MileageLog"("travelerUserId");
CREATE INDEX IF NOT EXISTS "MileageLog_logDate_idx" ON "MileageLog"("logDate");

-- AddForeignKey: MileageLog relations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'MileageLog_companyId_fkey'
    ) THEN
        ALTER TABLE "MileageLog" ADD CONSTRAINT "MileageLog_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'MileageLog_travelOrderId_fkey'
    ) THEN
        ALTER TABLE "MileageLog" ADD CONSTRAINT "MileageLog_travelOrderId_fkey"
        FOREIGN KEY ("travelOrderId") REFERENCES "TravelOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'MileageLog_travelerUserId_fkey'
    ) THEN
        ALTER TABLE "MileageLog" ADD CONSTRAINT "MileageLog_travelerUserId_fkey"
        FOREIGN KEY ("travelerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: TravelPdf
CREATE TABLE IF NOT EXISTS "TravelPdf" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "travelOrderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "r2Key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "isImmutable" BOOLEAN NOT NULL DEFAULT true,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelPdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: TravelPdf indexes
CREATE UNIQUE INDEX IF NOT EXISTS "TravelPdf_travelOrderId_version_key" ON "TravelPdf"("travelOrderId", "version");
CREATE INDEX IF NOT EXISTS "TravelPdf_companyId_idx" ON "TravelPdf"("companyId");
CREATE INDEX IF NOT EXISTS "TravelPdf_travelOrderId_idx" ON "TravelPdf"("travelOrderId");
CREATE INDEX IF NOT EXISTS "TravelPdf_sha256_idx" ON "TravelPdf"("sha256");

-- AddForeignKey: TravelPdf relations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelPdf_companyId_fkey'
    ) THEN
        ALTER TABLE "TravelPdf" ADD CONSTRAINT "TravelPdf_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelPdf_travelOrderId_fkey'
    ) THEN
        ALTER TABLE "TravelPdf" ADD CONSTRAINT "TravelPdf_travelOrderId_fkey"
        FOREIGN KEY ("travelOrderId") REFERENCES "TravelOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelPdf_generatedByUserId_fkey'
    ) THEN
        ALTER TABLE "TravelPdf" ADD CONSTRAINT "TravelPdf_generatedByUserId_fkey"
        FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
