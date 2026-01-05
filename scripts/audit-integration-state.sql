-- Phase 5: Integration Account Audit Queries
-- Run these queries to verify production state before enabling enforcement

-- =============================================================================
-- 1. Companies missing IntegrationAccount for enabled features
-- =============================================================================

-- Companies with fiscalization enabled but no FISCALIZATION_CIS account
SELECT
    c.id as company_id,
    c.name,
    'FISCALIZATION' as missing_integration,
    c."createdAt"
FROM "Company" c
WHERE 'fiscalization' = ANY(c.entitlements)
AND NOT EXISTS (
    SELECT 1 FROM integration_account ia
    WHERE ia."companyId" = c.id
    AND ia.kind = 'FISCALIZATION_CIS'
    AND ia.status = 'ACTIVE'
)
ORDER BY c."createdAt" DESC;

-- Companies with e-invoicing enabled but no EINVOICE_* account
SELECT
    c.id as company_id,
    c.name,
    'EINVOICE' as missing_integration,
    c."createdAt"
FROM "Company" c
WHERE 'e-invoicing' = ANY(c.entitlements)
AND NOT EXISTS (
    SELECT 1 FROM integration_account ia
    WHERE ia."companyId" = c.id
    AND ia.kind LIKE 'EINVOICE_%'
    AND ia.status = 'ACTIVE'
)
ORDER BY c."createdAt" DESC;

-- =============================================================================
-- 2. Records without integrationAccountId (need backfill)
-- =============================================================================

-- SENT/DELIVERED EInvoices without integrationAccountId
SELECT
    COUNT(*) as count,
    status,
    direction
FROM "EInvoice"
WHERE status IN ('SENT', 'DELIVERED')
AND "integrationAccountId" IS NULL
GROUP BY status, direction;

-- Sample of EInvoices needing backfill
SELECT
    id,
    "companyId",
    "invoiceNumber",
    status,
    direction,
    "createdAt"
FROM "EInvoice"
WHERE status IN ('SENT', 'DELIVERED')
AND "integrationAccountId" IS NULL
ORDER BY "createdAt" DESC
LIMIT 10;

-- COMPLETED FiscalRequests without integrationAccountId
SELECT
    COUNT(*) as count,
    "messageType"
FROM "FiscalRequest"
WHERE status = 'COMPLETED'
AND "integrationAccountId" IS NULL
GROUP BY "messageType";

-- Sample of FiscalRequests needing backfill
SELECT
    id,
    "companyId",
    "invoiceId",
    status,
    "messageType",
    "createdAt"
FROM "FiscalRequest"
WHERE status = 'COMPLETED'
AND "integrationAccountId" IS NULL
ORDER BY "createdAt" DESC
LIMIT 10;

-- ProviderSyncStates without integrationAccountId
SELECT
    COUNT(*) as count,
    provider,
    direction
FROM "ProviderSyncState"
WHERE "integrationAccountId" IS NULL
GROUP BY provider, direction;

-- =============================================================================
-- 3. Legacy secret fields still populated (should be migrated)
-- =============================================================================

-- Companies with legacy e-invoice secrets
SELECT
    c.id,
    c.name,
    CASE WHEN c."eInvoiceApiKeyEncrypted" IS NOT NULL THEN 'HAS_LEGACY_SECRET' ELSE 'CLEAN' END as legacy_status
FROM "Company" c
WHERE c."eInvoiceApiKeyEncrypted" IS NOT NULL
LIMIT 20;

-- Count of companies with legacy secrets
SELECT
    COUNT(*) as total_companies,
    COUNT(c."eInvoiceApiKeyEncrypted") as with_legacy_einvoice_secret
FROM "Company" c;

-- =============================================================================
-- 4. IntegrationAccount summary
-- =============================================================================

-- Total IntegrationAccounts by kind and status
SELECT
    kind,
    status,
    environment,
    COUNT(*) as count
FROM integration_account
GROUP BY kind, status, environment
ORDER BY kind, status, environment;

-- Recent IntegrationAccount usage
SELECT
    ia.id,
    ia."companyId",
    c.name as company_name,
    ia.kind,
    ia.status,
    ia.environment,
    ia."lastUsedAt",
    ia."createdAt"
FROM integration_account ia
JOIN "Company" c ON ia."companyId" = c.id
ORDER BY ia."lastUsedAt" DESC NULLS LAST
LIMIT 20;

-- =============================================================================
-- 5. Enforcement readiness summary
-- =============================================================================

-- Overall readiness check
SELECT
    'EInvoice SENT/DELIVERED without integrationAccountId' as check_name,
    COUNT(*) as violation_count,
    CASE WHEN COUNT(*) = 0 THEN 'READY' ELSE 'NOT READY' END as status
FROM "EInvoice"
WHERE status IN ('SENT', 'DELIVERED')
AND "integrationAccountId" IS NULL

UNION ALL

SELECT
    'FiscalRequest COMPLETED without integrationAccountId',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'READY' ELSE 'NOT READY' END
FROM "FiscalRequest"
WHERE status = 'COMPLETED'
AND "integrationAccountId" IS NULL

UNION ALL

SELECT
    'ProviderSyncState without integrationAccountId',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'READY' ELSE 'NOT READY' END
FROM "ProviderSyncState"
WHERE "integrationAccountId" IS NULL

UNION ALL

SELECT
    'Companies with fiscalization but no FISCALIZATION_CIS',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'READY' ELSE 'NOT READY' END
FROM "Company" c
WHERE 'fiscalization' = ANY(c.entitlements)
AND NOT EXISTS (
    SELECT 1 FROM integration_account ia
    WHERE ia."companyId" = c.id
    AND ia.kind = 'FISCALIZATION_CIS'
    AND ia.status = 'ACTIVE'
)

UNION ALL

SELECT
    'Companies with e-invoicing but no EINVOICE_*',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'READY' ELSE 'NOT READY' END
FROM "Company" c
WHERE 'e-invoicing' = ANY(c.entitlements)
AND NOT EXISTS (
    SELECT 1 FROM integration_account ia
    WHERE ia."companyId" = c.id
    AND ia.kind LIKE 'EINVOICE_%'
    AND ia.status = 'ACTIVE'
);
