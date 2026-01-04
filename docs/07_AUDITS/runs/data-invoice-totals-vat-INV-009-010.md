# Invoice Total & VAT Audit (INV-009, INV-010)

## Calculation & Validation Locations

- **Server-side creation**: `createEInvoice` multiplies `quantity * unitPrice`, computes VAT as `net * vatRate / 100`, and derives totals before persisting lines and header fields. No client totals are trusted. `Decimal` is used throughout to avoid floating errors.【F:src/app/actions/e-invoice.ts†L63-L126】
- **Server-side updates and classic invoices**: `createInvoice` and `updateInvoice` recompute the same fields server-side; updates delete/recreate lines before recalculating header totals, preventing tampering with stored totals.【F:src/app/actions/invoice.ts†L62-L110】【F:src/app/actions/invoice.ts†L168-L203】
- **Validation schema**: `eInvoiceLineSchema` requires positive quantity, non-negative unit price, and VAT rates between 0–100; at least one line item is required at the invoice level.【F:src/lib/validations/e-invoice.ts†L3-L22】
- **Persisted precision**: Prisma schema stores header and line amounts as `Decimal` columns with two decimals (quantities allow three) and VAT rates with two decimals, enforcing rounding at the database boundary.【F:prisma/schema.prisma†L210-L276】
- **Client calculations (display only)**: `InvoiceSummary` performs simple JS totals for UI preview; these values are not sent to the server and are superseded by server-side calculations.【F:src/components/invoice/invoice-summary.tsx†L20-L132】

## Scenarios (Computed from Server Logic)

_All scenarios use `net = quantity * unitPrice`, `vat = net * vatRate/100`, `total = net + vat`. Totals assume DB rounding to two decimals where applicable; runtime verification remains TODO (static review only)._

| Scenario           | Line Items (qty × price @ VAT%) | Expected Net | Expected VAT | Expected Total | Notes                                                             |
| ------------------ | ------------------------------- | ------------ | ------------ | -------------- | ----------------------------------------------------------------- |
| Standard 25%       | 2 × 100 @25%                    | 200.00       | 50.00        | 250.00         | Straightforward 25% rate.                                         |
| Mixed rates        | 1 × 80 @13%; 3 × 20 @25%        | 140.00       | 25.40        | 165.40         | Demonstrates aggregation across rates.                            |
| Zero VAT           | 5 × 10 @0%                      | 50.00        | 0.00         | 50.00          | VAT-exempt line.                                                  |
| Reduced & rounding | 1.5 × 19.99 @5%                 | 29.99        | 1.50         | 31.49          | 1.5 qty leads to 29.985 net → stored as 29.99; VAT 1.4995 → 1.50. |
| Fractional qty 25% | 0.333 × 100 @25%                | 33.30        | 8.33         | 41.63          | Three-decimal qty; DB scale rounds amounts to 2 decimals.         |

## Findings

- **Server-side enforcement present**: Both creation and update paths recompute line and header totals on the server using Decimal math, so client manipulation of totals is not trusted (addresses INV-009).【F:src/app/actions/e-invoice.ts†L63-L126】【F:src/app/actions/invoice.ts†L62-L110】
- **Validation covers VAT bounds**: Zod schema blocks negative or >100 VAT rates and requires at least one line, reducing invalid input risk (INV-010).【F:src/lib/validations/e-invoice.ts†L3-L22】
- **Rounding relies on DB scale**: No explicit rounding helper is applied; values rely on Prisma Decimal + DB column scales to clamp to two decimals. Consider adding explicit rounding if regulatory rules need bank rounding consistency across environments.
- **Client totals are advisory**: UI previews compute totals client-side, but persisted values come from server calculations, so discrepancies would resolve in favor of server truth.【F:src/components/invoice/invoice-summary.tsx†L20-L132】【F:src/app/actions/e-invoice.ts†L63-L126】

## Evidence Links

- Server total computation and persistence: `src/app/actions/e-invoice.ts`, `src/app/actions/invoice.ts`.
- Validation schema: `src/lib/validations/e-invoice.ts`.
- Persistence precision: `prisma/schema.prisma` (EInvoice & EInvoiceLine models).
- Client display totals (non-authoritative): `src/components/invoice/invoice-summary.tsx`.

## TODO

- Run runtime verification with sample payloads to confirm DB rounding behavior matches expectations (blocked in this audit run).
