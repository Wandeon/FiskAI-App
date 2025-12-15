# Security Audit: Fiscal Certificates (INV-008, INV-015)

## Scope
- Storage, encryption, and handling of fiscal certificates and signing keys.
- Verification of encryption algorithm/parameters and key management.
- Secret hygiene and potential logging of sensitive material.

## Data Flow (Text Diagram)
- **Upload**: User uploads P12 (base64) + password via `saveCertificateAction` ➜ parsed for validation ➜ combined into JSON payload. 【F:src/app/actions/fiscal-certificate.ts†L71-L120】
- **Encryption & Storage**: Payload encrypted with per-certificate data key (AES-256-GCM) and master key `FISCAL_CERT_KEY`; ciphertext/IV/tag and encrypted data key stored in `FiscalCertificate.encryptedP12` and `encryptedDataKey` columns. 【F:src/lib/fiscal/envelope-encryption.ts†L4-L86】【F:prisma/schema.prisma†L1007-L1031】
- **Load/Decrypt**: When executing fiscal request, certificate record is loaded ➜ `decryptWithEnvelope` unwraps data key and decrypts payload to recover P12+password. 【F:src/lib/fiscal/fiscal-pipeline.ts†L22-L49】
- **Use**: P12 parsed to PEM key/cert ➜ XML signed and sent to tax authority; request/signed/response XML persisted with reference to certificate ID. 【F:src/lib/fiscal/fiscal-pipeline.ts†L50-L127】

## Crypto Implementation Evidence
- Encryption uses `aes-256-gcm` with 32-byte master key sourced from `FISCAL_CERT_KEY` (required 64 hex chars). 【F:src/lib/fiscal/envelope-encryption.ts†L4-L13】
- Per-certificate 32-byte random data key and 12-byte IV encrypt plaintext payload; auth tag captured and stored alongside IV and ciphertext. 【F:src/lib/fiscal/envelope-encryption.ts†L21-L53】
- Data key envelope: encrypted under master key with its own random 12-byte IV and GCM auth tag; both ciphertexts stored as `iv:ciphertext:tag` strings. 【F:src/lib/fiscal/envelope-encryption.ts†L33-L53】
- Decryption mirrors both GCM operations, reapplying auth tags before finalizing to ensure integrity. 【F:src/lib/fiscal/envelope-encryption.ts†L56-L86】

## Secret Inventory Alignment
- Application schema stores only encrypted certificate blobs and encrypted data keys; no plaintext fields. 【F:prisma/schema.prisma†L1007-L1031】
- `.env.example` documents `FISCAL_CERT_KEY` requirement and size expectation, aligning with runtime checks. 【F:.env.example†L55-L58】
- `docker-compose.prod.yml` references `FISCAL_CERT_KEY` as a secret to be provided at deploy time (comment). 【F:docker-compose.prod.yml†L11-L24】
- Repository search shows no committed certificate/private-key files (`.p12/.pfx/.pem/.key`). 【8ebba6†L1-L2】
- Root `AGENTS.md` contains plaintext Coolify admin credentials and API token, indicating secret hygiene issue unrelated to certificates but present in repo. 【F:AGENTS.md†L30-L102】

## Findings
- **Encrypted-at-rest certificate storage (Informational)**: Fiscal certificates are stored only after envelope encryption with AES-256-GCM; data keys are randomly generated per certificate and wrapped by master key `FISCAL_CERT_KEY`. Evidence above.
- **Logging of OIB values (Low)**: Validation logs a warning with certificate and company OIB on mismatch, which could expose personal OIBs in server logs. 【F:src/app/actions/fiscal-certificate.ts†L46-L48】
- **Repository secrets (Medium)**: `AGENTS.md` includes real service credentials/token, violating secret-hygiene expectations even though no certificates are present. 【F:AGENTS.md†L30-L102】

## Evidence Checklist
- Encryption algorithm/parameters: `src/lib/fiscal/envelope-encryption.ts`. 【F:src/lib/fiscal/envelope-encryption.ts†L4-L86】
- Storage fields: `prisma/schema.prisma` model `FiscalCertificate`. 【F:prisma/schema.prisma†L1007-L1031】
- Certificate ingest/decrypt/use: `src/app/actions/fiscal-certificate.ts`, `src/lib/fiscal/fiscal-pipeline.ts`. 【F:src/app/actions/fiscal-certificate.ts†L71-L120】【F:src/lib/fiscal/fiscal-pipeline.ts†L22-L127】
- Environment/secret alignment: `.env.example`, `docker-compose.prod.yml`. 【F:.env.example†L55-L58】【F:docker-compose.prod.yml†L11-L24】
- Secret hygiene concern: `AGENTS.md` credentials. 【F:AGENTS.md†L30-L102】
- Absence of committed certificate/key artifacts: repo scan. 【8ebba6†L1-L2】
