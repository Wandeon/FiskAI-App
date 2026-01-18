-- CreateUniqueIndex
-- Ensures each field can only have one provenance record per entity
CREATE UNIQUE INDEX "DataProvenance_entityType_entityId_field_key" ON "DataProvenance"("entityType", "entityId", "field");
