-- Knowledge Shapes Phase 1 Schema Migration
-- This migration adds 7 knowledge shape models and supporting enums

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('TAXPAYER', 'EMPLOYER', 'COMPANY', 'INDIVIDUAL', 'ALL');

-- CreateEnum
CREATE TYPE "AssertionType" AS ENUM ('OBLIGATION', 'PROHIBITION', 'PERMISSION', 'DEFINITION');

-- CreateEnum
CREATE TYPE "ProcessType" AS ENUM ('REGISTRATION', 'FILING', 'APPEAL', 'CLOSURE', 'AMENDMENT', 'INQUIRY');

-- CreateEnum
CREATE TYPE "ReferenceCategory" AS ENUM ('IBAN', 'CN_CODE', 'TAX_OFFICE', 'INTEREST_RATE', 'EXCHANGE_RATE', 'FORM_CODE', 'DEADLINE_CALENDAR');

-- CreateEnum
CREATE TYPE "AssetFormat" AS ENUM ('PDF', 'XML', 'XLS', 'XLSX', 'DOC', 'DOCX', 'HTML');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('FORM', 'TEMPLATE', 'GUIDE', 'INSTRUCTION', 'REGULATION_TEXT');

-- CreateEnum
CREATE TYPE "TransitionPattern" AS ENUM ('INVOICE_DATE', 'DELIVERY_DATE', 'PAYMENT_DATE', 'EARLIER_EVENT', 'LATER_EVENT', 'TAXPAYER_CHOICE');

-- AlterEnum
ALTER TYPE "GraphEdgeType" ADD VALUE 'OVERRIDES';

-- CreateTable (AtomicClaim)
CREATE TABLE "AtomicClaim" (
    "id" TEXT NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subjectQualifiers" TEXT[],
    "triggerExpr" TEXT,
    "temporalExpr" TEXT,
    "jurisdiction" TEXT NOT NULL DEFAULT 'HR',
    "assertionType" "AssertionType" NOT NULL,
    "logicExpr" TEXT NOT NULL,
    "value" TEXT,
    "valueType" TEXT,
    "parameters" JSONB,
    "exactQuote" TEXT NOT NULL,
    "articleNumber" TEXT,
    "lawReference" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "evidenceId" TEXT NOT NULL,
    "ruleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtomicClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable (ClaimException)
CREATE TABLE "ClaimException" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "overridesTo" TEXT NOT NULL,
    "sourceArticle" TEXT NOT NULL,

    CONSTRAINT "ClaimException_pkey" PRIMARY KEY ("id")
);

-- CreateTable (ConceptNode)
CREATE TABLE "ConceptNode" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameHr" TEXT NOT NULL,
    "nameEn" TEXT,
    "parentId" TEXT,
    "synonyms" TEXT[],
    "hyponyms" TEXT[],
    "legalCategory" TEXT,
    "vatCategory" TEXT,
    "searchTerms" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConceptNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable (RegulatoryProcess)
CREATE TABLE "RegulatoryProcess" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleHr" TEXT NOT NULL,
    "titleEn" TEXT,
    "jurisdiction" TEXT NOT NULL DEFAULT 'HR',
    "processType" "ProcessType" NOT NULL,
    "estimatedTime" TEXT,
    "prerequisites" JSONB,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatoryProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable (ProcessStep)
CREATE TABLE "ProcessStep" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "orderNum" INTEGER NOT NULL,
    "actionHr" TEXT NOT NULL,
    "actionEn" TEXT,
    "requiresStepIds" TEXT[],
    "requiresAssets" TEXT[],
    "onSuccessStepId" TEXT,
    "onFailureStepId" TEXT,
    "failureAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable (ReferenceTable)
CREATE TABLE "ReferenceTable" (
    "id" TEXT NOT NULL,
    "category" "ReferenceCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'HR',
    "keyColumn" TEXT NOT NULL,
    "valueColumn" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable (ReferenceEntry)
CREATE TABLE "ReferenceEntry" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable (RegulatoryAsset)
CREATE TABLE "RegulatoryAsset" (
    "id" TEXT NOT NULL,
    "formCode" TEXT,
    "officialName" TEXT NOT NULL,
    "description" TEXT,
    "downloadUrl" TEXT NOT NULL,
    "format" "AssetFormat" NOT NULL,
    "fileSize" INTEGER,
    "assetType" "AssetType" NOT NULL,
    "processId" TEXT,
    "stepNumber" INTEGER,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "version" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatoryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable (TransitionalProvision)
CREATE TABLE "TransitionalProvision" (
    "id" TEXT NOT NULL,
    "fromRule" TEXT NOT NULL,
    "toRule" TEXT NOT NULL,
    "cutoffDate" TIMESTAMP(3) NOT NULL,
    "logicExpr" TEXT NOT NULL,
    "appliesRule" TEXT NOT NULL,
    "explanationHr" TEXT NOT NULL,
    "explanationEn" TEXT,
    "pattern" "TransitionPattern" NOT NULL,
    "sourceArticle" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransitionalProvision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtomicClaim_subjectType_idx" ON "AtomicClaim"("subjectType");
CREATE INDEX "AtomicClaim_assertionType_idx" ON "AtomicClaim"("assertionType");
CREATE INDEX "AtomicClaim_jurisdiction_idx" ON "AtomicClaim"("jurisdiction");
CREATE INDEX "AtomicClaim_evidenceId_idx" ON "AtomicClaim"("evidenceId");
CREATE INDEX "AtomicClaim_ruleId_idx" ON "AtomicClaim"("ruleId");

-- CreateIndex
CREATE INDEX "ClaimException_claimId_idx" ON "ClaimException"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptNode_slug_key" ON "ConceptNode"("slug");
CREATE INDEX "ConceptNode_legalCategory_idx" ON "ConceptNode"("legalCategory");
CREATE INDEX "ConceptNode_vatCategory_idx" ON "ConceptNode"("vatCategory");
CREATE INDEX "ConceptNode_parentId_idx" ON "ConceptNode"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryProcess_slug_key" ON "RegulatoryProcess"("slug");
CREATE INDEX "RegulatoryProcess_processType_idx" ON "RegulatoryProcess"("processType");
CREATE INDEX "RegulatoryProcess_jurisdiction_idx" ON "RegulatoryProcess"("jurisdiction");
CREATE INDEX "RegulatoryProcess_evidenceId_idx" ON "RegulatoryProcess"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessStep_processId_orderNum_key" ON "ProcessStep"("processId", "orderNum");
CREATE INDEX "ProcessStep_processId_idx" ON "ProcessStep"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceTable_category_name_jurisdiction_key" ON "ReferenceTable"("category", "name", "jurisdiction");
CREATE INDEX "ReferenceTable_category_idx" ON "ReferenceTable"("category");
CREATE INDEX "ReferenceTable_jurisdiction_idx" ON "ReferenceTable"("jurisdiction");

-- CreateIndex
CREATE INDEX "ReferenceEntry_tableId_key_idx" ON "ReferenceEntry"("tableId", "key");
CREATE INDEX "ReferenceEntry_tableId_idx" ON "ReferenceEntry"("tableId");

-- CreateIndex
CREATE INDEX "RegulatoryAsset_formCode_idx" ON "RegulatoryAsset"("formCode");
CREATE INDEX "RegulatoryAsset_assetType_idx" ON "RegulatoryAsset"("assetType");
CREATE INDEX "RegulatoryAsset_processId_idx" ON "RegulatoryAsset"("processId");
CREATE INDEX "RegulatoryAsset_evidenceId_idx" ON "RegulatoryAsset"("evidenceId");

-- CreateIndex
CREATE INDEX "TransitionalProvision_cutoffDate_idx" ON "TransitionalProvision"("cutoffDate");
CREATE INDEX "TransitionalProvision_fromRule_idx" ON "TransitionalProvision"("fromRule");
CREATE INDEX "TransitionalProvision_toRule_idx" ON "TransitionalProvision"("toRule");
CREATE INDEX "TransitionalProvision_evidenceId_idx" ON "TransitionalProvision"("evidenceId");

-- AddForeignKey
ALTER TABLE "AtomicClaim" ADD CONSTRAINT "AtomicClaim_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AtomicClaim" ADD CONSTRAINT "AtomicClaim_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RegulatoryRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimException" ADD CONSTRAINT "ClaimException_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "AtomicClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptNode" ADD CONSTRAINT "ConceptNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ConceptNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryProcess" ADD CONSTRAINT "RegulatoryProcess_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStep" ADD CONSTRAINT "ProcessStep_processId_fkey" FOREIGN KEY ("processId") REFERENCES "RegulatoryProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceTable" ADD CONSTRAINT "ReferenceTable_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceEntry" ADD CONSTRAINT "ReferenceEntry_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "ReferenceTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryAsset" ADD CONSTRAINT "RegulatoryAsset_processId_fkey" FOREIGN KEY ("processId") REFERENCES "RegulatoryProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegulatoryAsset" ADD CONSTRAINT "RegulatoryAsset_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransitionalProvision" ADD CONSTRAINT "TransitionalProvision_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
