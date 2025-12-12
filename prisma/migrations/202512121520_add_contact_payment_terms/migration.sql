-- Add payment terms per contact (default 15 days)
ALTER TABLE "Contact"
  ADD COLUMN "paymentTermsDays" INTEGER NOT NULL DEFAULT 15;
