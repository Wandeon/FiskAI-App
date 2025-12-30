-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RecurringExpense" ADD COLUMN "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Backfill vatRate for existing expenses based on calculation from amounts
UPDATE "Expense"
SET "vatRate" = CASE
  WHEN "netAmount" > 0 THEN ROUND(("vatAmount" / "netAmount" * 100)::numeric, 2)
  ELSE 0
END
WHERE "vatRate" = 0;

-- Backfill vatRate for existing recurring expenses
UPDATE "RecurringExpense"
SET "vatRate" = CASE
  WHEN "netAmount" > 0 THEN ROUND(("vatAmount" / "netAmount" * 100)::numeric, 2)
  ELSE 0
END
WHERE "vatRate" = 0;
