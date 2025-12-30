-- Add escalation fields to SupportTicket
ALTER TABLE "SupportTicket" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "slaDeadline" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "escalatedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "escalatedTo" TEXT;

-- Add indexes for efficient querying
CREATE INDEX "SupportTicket_slaDeadline_idx" ON "SupportTicket"("slaDeadline");
CREATE INDEX "SupportTicket_escalatedAt_idx" ON "SupportTicket"("escalatedAt");
