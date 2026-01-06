-- CreateTable: applied_rule_snapshot
-- Stores immutable snapshots of regulatory rules at the time they were applied to transactions
-- Used for JOPPD and Payout audit trails

CREATE TABLE "applied_rule_snapshot" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "rule_version_id" TEXT NOT NULL,
    "rule_table_key" VARCHAR(100) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "effective_from" DATE NOT NULL,
    "data_hash" VARCHAR(64) NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applied_rule_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Dedupe index for upsert operations
CREATE UNIQUE INDEX "applied_rule_snapshot_dedupe_idx" ON "applied_rule_snapshot"("company_id", "rule_version_id", "data_hash");

-- CreateIndex: Lookup index for finding rules by table and date
CREATE INDEX "applied_rule_snapshot_lookup_idx" ON "applied_rule_snapshot"("company_id", "rule_table_key", "effective_from");

-- CreateIndex: Hash lookup index
CREATE INDEX "applied_rule_snapshot_hash_idx" ON "applied_rule_snapshot"("company_id", "data_hash");

-- AddForeignKey: Link to Company (cascade delete)
ALTER TABLE "applied_rule_snapshot" ADD CONSTRAINT "applied_rule_snapshot_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
