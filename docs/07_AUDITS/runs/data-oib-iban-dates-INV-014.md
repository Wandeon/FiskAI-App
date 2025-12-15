# Audit: INV-014 OIB/IBAN and Date Validation

## Validation rule evidence
- **OIB format (contacts)**: `contactSchema` requires `oib` to match exactly 11 digits via regex; no checksum enforcement here. 【F:src/lib/validations/contact.ts†L3-L17】
- **OIB checksum (lookup API)**: `validateOib` implements ISO 7064 MOD 11-10 and rejects inputs failing the checksum or digit length. 【F:src/lib/oib-lookup.ts†L82-L102】
- **OIB request validation (server API)**: `/api/oib/lookup` requires string OIB and fails requests missing the field or failing `validateOib`. 【F:src/app/api/oib/lookup/route.ts†L60-L99】
- **IBAN (e-invoice schema)**: `eInvoiceSchema` requires `bankAccount` to match Croatian IBAN pattern `^HR\d{19}$`, and `issueDate`/`dueDate` are coerced to `Date`. 【F:src/lib/validations/e-invoice.ts†L12-L25】
- **IBAN (bank account action schema)**: Dashboard banking actions trim/uppercase IBAN, enforce `HR` + 19 digits, and surface the first validation error message. 【F:src/app/(dashboard)/banking/actions.ts†L9-L88】
- **IBAN (banking actions service)**: Server-side banking service also validates Croatian IBAN format before creation and rejects duplicates per company. 【F:src/app/actions/banking.ts†L24-L75】
- **Date handling (bank import)**: Bank statement import schema accepts dates as strings or Date objects, then each transaction is `new Date(txn.date)` without timezone normalization. 【F:src/app/(dashboard)/banking/actions.ts†L158-L260】
- **Date handling (e-invoice creation)**: `createEInvoice` uses `eInvoiceSchema.safeParse`, so `issueDate`/`dueDate` must pass Zod date coercion before persisting. 【F:src/app/actions/e-invoice.ts†L16-L120】【F:src/lib/validations/e-invoice.ts†L12-L22】

## Where validation is applied server side
- **Contact create/update actions** call `contactSchema.safeParse` before writing, so OIB digit-length regex is enforced server side for contact records. 【F:src/app/actions/contact.ts†L9-L57】
- **OIB lookup endpoint** enforces checksum validation in the POST handler, preventing server-side lookups with invalid OIBs. 【F:src/app/api/oib/lookup/route.ts†L60-L99】
- **E-invoice creation action** validates inputs server side with `eInvoiceSchema.safeParse`, covering buyer ID, IBAN format, and date coercion. 【F:src/app/actions/e-invoice.ts†L16-L120】
- **Bank account creation actions** in both dashboard server actions and shared banking service enforce IBAN formatting and reject duplicates through Prisma queries. 【F:src/app/(dashboard)/banking/actions.ts†L9-L88】【F:src/app/actions/banking.ts†L24-L75】
- **Bank statement import** validates transaction rows with Zod before writing and converts the provided date string to a `Date` during persistence. 【F:src/app/(dashboard)/banking/actions.ts†L158-L260】

## Gaps and needed fixes
- **OIB checksum not enforced for contacts/invoices**: Contacts rely only on an 11-digit regex, so checksum-invalid OIBs are accepted. Align contact (and any invoice buyer/seller OIB) validation with `validateOib` to enforce MOD 11-10. 【F:src/lib/validations/contact.ts†L3-L17】【F:src/lib/oib-lookup.ts†L82-L102】
- **Date timezone/validity checks**: Bank import accepts any string convertible by `new Date`, so locale-formatted strings may shift timezones or become `Invalid Date` silently. Add explicit date parsing/validation (e.g., ISO 8601 check or Zod refinement) and normalize to UTC to avoid drift. 【F:src/app/(dashboard)/banking/actions.ts†L158-L260】
- **IBAN validation scope**: IBAN checks focus on Croatian format; cross-border IBANs for non-HR entities would fail. Confirm business intent or extend validation when multi-country support is needed. 【F:src/lib/validations/e-invoice.ts†L12-L22】【F:src/app/(dashboard)/banking/actions.ts†L9-L19】

## Negative test cases (expected to fail)
- OIB with letters or not exactly 11 digits should be rejected by contact actions (regex) and lookup API. 【F:src/lib/validations/contact.ts†L3-L17】【F:src/app/api/oib/lookup/route.ts†L60-L83】
- OIB with invalid MOD 11 checksum should fail the lookup API (passes contact action today; fix needed). 【F:src/lib/oib-lookup.ts†L82-L102】【F:src/app/api/oib/lookup/route.ts†L60-L83】
- IBAN not starting with `HR` or not 21 characters should be rejected by e-invoice creation and bank account creation actions. 【F:src/lib/validations/e-invoice.ts†L12-L22】【F:src/app/(dashboard)/banking/actions.ts†L9-L38】
- Duplicate IBAN for the same company should fail with a specific error during bank account creation. 【F:src/app/actions/banking.ts†L44-L75】【F:src/app/(dashboard)/banking/actions.ts†L70-L88】
- Bank import rows with non-numeric amounts or missing required fields trigger Zod validation errors; malformed dates currently pass to `new Date` and could store incorrect timestamps (gap to fix). 【F:src/app/(dashboard)/banking/actions.ts†L158-L260】

## Timezone handling notes
- E-invoice dates rely on JavaScript `Date` objects produced by Zod coercion; no explicit timezone normalization is applied before storing. 【F:src/lib/validations/e-invoice.ts†L12-L22】【F:src/app/actions/e-invoice.ts†L16-L120】
- Bank transaction import uses `new Date` on incoming strings without timezone context, so `YYYY-MM-DD` values will be interpreted in the server timezone, risking off-by-one-day shifts. Introduce explicit parsing (e.g., `Date.UTC`) or require ISO timestamps with offsets to remove ambiguity. 【F:src/app/(dashboard)/banking/actions.ts†L158-L260】
