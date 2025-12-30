-- Add registration_date column to pausalni_profile table
-- This field tracks when the business was registered (obrt osnovan)
-- Used to filter obligations - businesses shouldn't have obligations before registration

ALTER TABLE "pausalni_profile" ADD COLUMN "registration_date" date;
