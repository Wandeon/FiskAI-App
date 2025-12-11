-- Add notificationSeenAt column for tracking unread notification state per company user
ALTER TABLE "CompanyUser"
ADD COLUMN "notificationSeenAt" TIMESTAMP(3);
