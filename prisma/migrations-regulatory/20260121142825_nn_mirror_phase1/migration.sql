-- NN Mirror Phase 1 Migration
-- Creates canonical parsed layer: ParsedDocument, ProvisionNode, ReparseJob
-- Plus Evidence.sourceKey field

-- A1: Create ParseStatus enum
DO $$ BEGIN
    CREATE TYPE "regulatory"."ParseStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- A1: Create OffsetUnit enum
DO $$ BEGIN
    CREATE TYPE "regulatory"."OffsetUnit" AS ENUM ('UTF16', 'UTF8', 'CODEPOINT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- A3: Create ProvisionNodeType enum
DO $$ BEGIN
    CREATE TYPE "regulatory"."ProvisionNodeType" AS ENUM ('DOC', 'TITLE', 'CHAPTER', 'PART', 'CLANAK', 'STAVAK', 'TOCKA', 'PODTOCKA', 'ALINEJA', 'PRILOG', 'TABLE', 'LIST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- A2: Create ParsedDocument table
CREATE TABLE IF NOT EXISTS "regulatory"."ParsedDocument" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "parserId" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "parseConfigHash" TEXT NOT NULL,
    "status" "regulatory"."ParseStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "warnings" JSONB,
    "unparsedSegments" JSONB,
    "docMeta" JSONB,
    "cleanTextArtifactId" TEXT,
    "cleanTextLength" INTEGER,
    "cleanTextHash" TEXT,
    "offsetUnit" "regulatory"."OffsetUnit" NOT NULL DEFAULT 'UTF16',
    "nodeCount" INTEGER NOT NULL DEFAULT 0,
    "maxDepth" INTEGER NOT NULL DEFAULT 0,
    "statsByType" JSONB,
    "coverageChars" INTEGER,
    "coveragePercent" DOUBLE PRECISION,
    "treeHash" TEXT,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "supersedesId" TEXT,
    "supersededById" TEXT,
    "driftDetectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parseDurationMs" INTEGER,

    CONSTRAINT "ParsedDocument_pkey" PRIMARY KEY ("id")
);

-- A2: ParsedDocument unique constraint and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ParsedDocument_evidenceId_parserId_parserVersion_parseConfigHash_key"
    ON "regulatory"."ParsedDocument"("evidenceId", "parserId", "parserVersion", "parseConfigHash");
CREATE UNIQUE INDEX IF NOT EXISTS "ParsedDocument_supersedesId_key" ON "regulatory"."ParsedDocument"("supersedesId");
CREATE UNIQUE INDEX IF NOT EXISTS "ParsedDocument_supersededById_key" ON "regulatory"."ParsedDocument"("supersededById");
CREATE INDEX IF NOT EXISTS "ParsedDocument_evidenceId_idx" ON "regulatory"."ParsedDocument"("evidenceId");
CREATE INDEX IF NOT EXISTS "ParsedDocument_evidenceId_parserId_isLatest_idx" ON "regulatory"."ParsedDocument"("evidenceId", "parserId", "isLatest");
CREATE INDEX IF NOT EXISTS "ParsedDocument_parserId_status_createdAt_idx" ON "regulatory"."ParsedDocument"("parserId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ParsedDocument_status_idx" ON "regulatory"."ParsedDocument"("status");

-- A2: ParsedDocument foreign keys
ALTER TABLE "regulatory"."ParsedDocument"
    ADD CONSTRAINT "ParsedDocument_evidenceId_fkey"
    FOREIGN KEY ("evidenceId") REFERENCES "regulatory"."Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "regulatory"."ParsedDocument"
    ADD CONSTRAINT "ParsedDocument_cleanTextArtifactId_fkey"
    FOREIGN KEY ("cleanTextArtifactId") REFERENCES "regulatory"."EvidenceArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "regulatory"."ParsedDocument"
    ADD CONSTRAINT "ParsedDocument_supersedesId_fkey"
    FOREIGN KEY ("supersedesId") REFERENCES "regulatory"."ParsedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A3: Create ProvisionNode table
CREATE TABLE IF NOT EXISTS "regulatory"."ProvisionNode" (
    "id" TEXT NOT NULL,
    "parsedDocumentId" TEXT NOT NULL,
    "parentId" TEXT,
    "nodeType" "regulatory"."ProvisionNodeType" NOT NULL,
    "nodePath" TEXT NOT NULL,
    "label" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL,
    "rawText" TEXT,
    "normalizedText" TEXT,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "isContainer" BOOLEAN NOT NULL DEFAULT false,
    "htmlSelector" TEXT,

    CONSTRAINT "ProvisionNode_pkey" PRIMARY KEY ("id")
);

-- A3: ProvisionNode unique constraint and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ProvisionNode_parsedDocumentId_nodePath_key"
    ON "regulatory"."ProvisionNode"("parsedDocumentId", "nodePath");
CREATE INDEX IF NOT EXISTS "ProvisionNode_parsedDocumentId_parentId_orderIndex_idx"
    ON "regulatory"."ProvisionNode"("parsedDocumentId", "parentId", "orderIndex");
CREATE INDEX IF NOT EXISTS "ProvisionNode_parsedDocumentId_nodeType_idx"
    ON "regulatory"."ProvisionNode"("parsedDocumentId", "nodeType");
CREATE INDEX IF NOT EXISTS "ProvisionNode_parsedDocumentId_startOffset_idx"
    ON "regulatory"."ProvisionNode"("parsedDocumentId", "startOffset");

-- A3: ProvisionNode foreign keys
ALTER TABLE "regulatory"."ProvisionNode"
    ADD CONSTRAINT "ProvisionNode_parsedDocumentId_fkey"
    FOREIGN KEY ("parsedDocumentId") REFERENCES "regulatory"."ParsedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "regulatory"."ProvisionNode"
    ADD CONSTRAINT "ProvisionNode_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "regulatory"."ProvisionNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A5: Add Evidence.sourceKey field
ALTER TABLE "regulatory"."Evidence" ADD COLUMN IF NOT EXISTS "sourceKey" TEXT;
CREATE INDEX IF NOT EXISTS "Evidence_sourceKey_idx" ON "regulatory"."Evidence"("sourceKey");

-- A7: Create ReparseJob table
CREATE TABLE IF NOT EXISTS "regulatory"."ReparseJob" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "previousParseId" TEXT,
    "newParseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "ReparseJob_pkey" PRIMARY KEY ("id")
);

-- A7: ReparseJob indexes
CREATE INDEX IF NOT EXISTS "ReparseJob_status_priority_createdAt_idx"
    ON "regulatory"."ReparseJob"("status", "priority", "createdAt");
CREATE INDEX IF NOT EXISTS "ReparseJob_evidenceId_idx"
    ON "regulatory"."ReparseJob"("evidenceId");
