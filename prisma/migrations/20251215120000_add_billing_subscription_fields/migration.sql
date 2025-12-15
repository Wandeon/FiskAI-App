-- Add billing and subscription fields to Company
-- This migration adds Stripe subscription tracking and trial management

-- Add subscription and billing fields to Company
ALTER TABLE "Company" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Company" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Company" ADD COLUMN "subscriptionStatus" TEXT DEFAULT 'trialing';
ALTER TABLE "Company" ADD COLUMN "subscriptionPlan" TEXT DEFAULT 'pausalni';
ALTER TABLE "Company" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "subscriptionCurrentPeriodStart" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "subscriptionCurrentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "invoiceLimit" INTEGER DEFAULT 50;
ALTER TABLE "Company" ADD COLUMN "userLimit" INTEGER DEFAULT 1;

-- Create index for Stripe customer lookup
CREATE UNIQUE INDEX "Company_stripeCustomerId_key" ON "Company"("stripeCustomerId");
CREATE UNIQUE INDEX "Company_stripeSubscriptionId_key" ON "Company"("stripeSubscriptionId");

-- Set trial end date for existing companies (14 days from now)
UPDATE "Company" SET "trialEndsAt" = NOW() + INTERVAL '14 days' WHERE "trialEndsAt" IS NULL;
