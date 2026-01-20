-- Event-Driven KG Edges Migration
--
-- This migration adds infrastructure for event-driven edge building:
-- 1. GraphStatus enum for tracking edge state per rule
-- 2. graphStatus column on RegulatoryRule
-- 3. Updated unique constraint on GraphEdge to include namespace

-- CreateEnum: GraphStatus
CREATE TYPE "GraphStatus" AS ENUM ('PENDING', 'CURRENT', 'STALE');

-- Add graphStatus column to RegulatoryRule
ALTER TABLE "RegulatoryRule" ADD COLUMN "graphStatus" "GraphStatus" NOT NULL DEFAULT 'PENDING';

-- Update unique constraint on GraphEdge to include namespace
-- First, drop the existing constraint
DROP INDEX IF EXISTS "GraphEdge_fromRuleId_toRuleId_relation_key";

-- Then create the new constraint with namespace
CREATE UNIQUE INDEX "GraphEdge_namespace_fromRuleId_toRuleId_relation_key"
ON "GraphEdge"("namespace", "fromRuleId", "toRuleId", "relation");
