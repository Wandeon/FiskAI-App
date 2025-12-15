-- Add email tracking fields to EInvoice
-- These fields track the delivery status of invoice emails via Resend webhooks

-- Email message ID from Resend (used to correlate webhook events)
ALTER TABLE "EInvoice" ADD COLUMN "emailMessageId" TEXT;

-- Email delivery tracking timestamps
ALTER TABLE "EInvoice" ADD COLUMN "emailDeliveredAt" TIMESTAMP(3);
ALTER TABLE "EInvoice" ADD COLUMN "emailOpenedAt" TIMESTAMP(3);
ALTER TABLE "EInvoice" ADD COLUMN "emailClickedAt" TIMESTAMP(3);
ALTER TABLE "EInvoice" ADD COLUMN "emailBouncedAt" TIMESTAMP(3);

-- Bounce details
ALTER TABLE "EInvoice" ADD COLUMN "emailBounceReason" TEXT;

-- Index for looking up by message ID (webhook correlation)
CREATE INDEX "EInvoice_emailMessageId_idx" ON "EInvoice"("emailMessageId");
