-- Enforce "exactly one default company per user" for CompanyUser.
-- Postgres partial unique index (cannot be expressed in Prisma schema directly).
--
-- Safety:
-- 1) Repair existing duplicates deterministically (keep newest createdAt, tie-break by id)
-- 2) Add partial unique index to prevent future duplicates

WITH ranked_defaults AS (
  SELECT
    id,
    "userId",
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC, id DESC) AS rn
  FROM "CompanyUser"
  WHERE "isDefault" = TRUE
)
UPDATE "CompanyUser" cu
SET "isDefault" = FALSE
FROM ranked_defaults r
WHERE cu.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'companyuser_one_default_per_user'
  ) THEN
    CREATE UNIQUE INDEX companyuser_one_default_per_user
      ON "CompanyUser" ("userId")
      WHERE "isDefault" = TRUE;
  END IF;
END $$;

