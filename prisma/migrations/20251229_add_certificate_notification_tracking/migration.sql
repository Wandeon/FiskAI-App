-- Add certificate expiry notification tracking fields
ALTER TABLE "FiscalCertificate" ADD COLUMN "lastExpiryNotificationAt" TIMESTAMP(3);
ALTER TABLE "FiscalCertificate" ADD COLUMN "lastExpiryNotificationDay" INTEGER;

-- Add comment explaining the fields
COMMENT ON COLUMN "FiscalCertificate"."lastExpiryNotificationAt" IS 'When the last expiry notification was sent';
COMMENT ON COLUMN "FiscalCertificate"."lastExpiryNotificationDay" IS 'Days remaining when notification was sent (30, 14, 7, or 1)';
