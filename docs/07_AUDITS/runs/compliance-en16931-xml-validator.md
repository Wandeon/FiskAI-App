# EN 16931 Validator & XML Builder Audit

## Builder and validator evidence

- **XML builder**: `generateUBLInvoice` produces UBL 2.1 invoices with EN 16931/PEPPOL identifiers, supplier/buyer party blocks, payment means (IBAN only), tax subtotals, monetary totals, and line details (quantity, unit, net, VAT category/rate). It throws if `buyer` is missing but otherwise allows empty IDs when no OIB is present. Currency is hard-coded to `EUR` in monetary fields regardless of invoice currency. 【F:src/lib/e-invoice/ubl-generator.ts†L1-L190】
- **Validator**: `validateEN16931Compliance` checks only a handful of required fields (invoice number, issue date, companyId, direction, buyer for outbound) and basic amount math; it marks `schemaValidation` as `true` without running any XSD/Schematron. Croatian-specific wrapper adds superficial OIB/JIR/ZKI checks. There are no external schema files in the repo. 【F:src/lib/compliance/en16931-validator.ts†L1-L248】【F:src/app/api/compliance/en16931/route.ts†L1-L172】
- **Validation surfaces**: Compliance API endpoints call `getComplianceSummary` for single and bulk checks and return JSON with counts and critical errors. Validation is not invoked in invoice creation or send flows. 【F:src/app/api/compliance/en16931/route.ts†L15-L172】【F:src/app/actions/e-invoice.ts†L132-L219】

## Flow coverage

- **API coverage**: `POST /api/compliance/en16931` fetches invoice data (including lines and parties) and returns summary flags; `GET /api/compliance/en16931` batches results with basic statistics. These endpoints are the only runtime integrations of the validator. 【F:src/app/api/compliance/en16931/route.ts†L15-L172】
- **Send flow**: `sendEInvoice` generates UBL XML and dispatches it to the provider without running EN 16931 validation or schema checks, so invalid XML can be sent. 【F:src/app/actions/e-invoice.ts†L132-L219】
- **Schema handling**: No UBL/EN16931 XSD or Schematron files exist in the repository, and `schemaValidation` is always marked true even though no schema is loaded. 【F:src/lib/compliance/en16931-validator.ts†L26-L165】

## Findings and fixes

1. **Missing schema validation**: There is no XSD/Schematron download or invocation even though the validator reports `schemaValidation: true`. Add schema assets (UBL 2.1 invoice XSD and EN 16931/PEPPOL Schematron) and run them in the validator so failures surface in API responses.
2. **Incomplete required field mapping**: Builder omits several EN 16931 mandatory elements (payment terms, tax currency code, supplier legal identifiers when OIB is absent) and hard-codes currency to `EUR` in amounts. Extend `generateUBLInvoice` to map invoice currency, payment terms/method, supplier VAT/OIB/endpoint IDs, and ensure buyer IDs are not emitted as empty strings.
3. **Validator coverage gaps**: Validation currently checks only a subset of required fields and does not compare XML against schema. Expand `validateEN16931Compliance` to enforce EN 16931 cardinality (e.g., supplier/buyer identifiers, currency consistency, payment means) and to fail when builder emits empty IDs or mismatched totals.
4. **Flow enforcement**: The send action bypasses compliance checks. Integrate `getComplianceSummary` (or a stricter schema-backed validator) before UBL generation/send, blocking or warning when critical errors exist, and store validation results alongside the invoice.

## Acceptance alignment

- Validator integration points are documented (only the compliance API uses it today), and the absence of schema files plus incomplete field mapping are highlighted with actionable remediation steps to cover missing required fields and enforcement prior to transmission.
