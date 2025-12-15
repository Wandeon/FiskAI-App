# Compliance Audit: INV-019 Certificate Handling & Retention

## Artifact Inventory and Locations
- **Fiscal certificates (P12/PFX)**: Encrypted payload (`encryptedP12`) and wrapped data key (`encryptedDataKey`) stored in `FiscalCertificate` table with metadata (serial, validity, OIB, status). Stored in PostgreSQL and protected via envelope encryption using the `FISCAL_CERT_KEY` master key. Processing decrypts via `decryptWithEnvelope` before use.
- **Fiscal requests**: `FiscalRequest` rows capture certificate linkage, invoice reference, queue metadata, and persisted XML artifacts (`requestXml`, `signedXml`, `responseXml`) along with JIR/ZKI and HTTP error metadata in PostgreSQL.
- **Invoices with fiscal status**: `EInvoice` records hold fiscalization status fields (`fiscalizedAt`, `fiscalStatus`, related `fiscalRequests`) in PostgreSQL for 11-year statutory retention.
- **Audit logs**: `AuditLog` table stores audit events (action/entity/changes/timestamp) for certificate upload/delete, request retries, manual fiscalization, etc., in PostgreSQL.
- **Backups**: Documentation prescribes daily `pg_dump` backups retained for 30 days; no code-level enforcement observed.

## Retention Implementation Evidence
- **Certificate encryption at rest**: Envelope encryption with random data keys; master key required via `FISCAL_CERT_KEY` for decrypting stored certificate payloads, ensuring stored artifacts remain encrypted in PostgreSQL.
- **Certificate lifecycle controls**: Certificate deletion explicitly blocked when fiscal requests are queued/processing; actions logged to `AuditLog`.
- **Fiscal request persistence**: Pipeline stores constructed, signed, and response XML plus ZKI in `FiscalRequest`, providing evidentiary trail tied to invoices.
- **Documented retention/backups**: Inventory lists 11-year retention for invoices/fiscal requests and 7-year retention for audit logs; operations runbook instructs 30-day backup retention via filesystem pruning.

## Gaps and Recommended Controls
- **Retention enforcement absent**: No automated retention/archival jobs for certificates, fiscal requests, invoices, or audit logs despite documented 7–11 year requirements. Add scheduled tasks or database policies to prevent premature deletion and to handle end-of-life archival after legal periods.
- **Certificate deletion vs. retention**: User-driven deletion (after pending checks) permanently removes certificates without preserving encrypted blobs or tombstones; evaluate legal need to retain certificate proofs for 11 years and implement soft-delete or immutable archive accordingly.
- **Backup automation evidence lacking**: Backup and 30-day retention described only in docs; no infrastructure config or scripts in repo to confirm scheduling. Provide deployment manifests or cron definitions and store verification logs.
- **Conflicting retention statements**: Inventory lists 7-year audit log retention while runbook states 3 years; align policy documents and implement matching enforcement.
- **Audit log integrity**: Audit logs lack immutability or tamper-evident controls; consider append-only storage (e.g., WORM bucket or signed digests) and integrity checksums for critical fiscal events.
