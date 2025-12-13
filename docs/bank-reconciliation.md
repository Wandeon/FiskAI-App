# Bank Reconciliation Config

## Auto-match rules

- **Threshold:** Transactions that score **≥85** are auto-matched (`AUTO_MATCH_THRESHOLD`). Anything below stays in `UNMATCHED`.
- **Score rules:**  
  1. Invoice number found in the bank reference → score 100 (exact match).  
  2. Net/total amount equal and invoice date within ±3 days → score 85.  
  3. Amount within ±5% and date within ±5 days → score 70 (treated as candidate, not auto-match).
- **Currency handling:** Matching currently assumes the transaction amount is in the same currency as the invoice (typically HRK/EUR). Cross-currency or EUR→HRK conversions aren’t auto-accounted; those entries stay `UNMATCHED` for manual review.
- **Invoice status:** Only outbound invoices with `paidAt = null` and fiscalized/released statuses are considered. When an auto-match happens, the invoice is updated to `paidAt = transaction.date` and status `ACCEPTED`.

## Manual overrides

- **Manual match endpoint:** `POST /api/banking/reconciliation/match` accepts `{ transactionId, invoiceId }`; it marks the transaction as `MANUAL_MATCHED`, pins `confidenceScore = 100`, and updates the invoice to `paid`.
- **Undo scenario:** Use the existing `/actions/banking/unmatchTransaction` workflow (or the transaction detail page) to reset status back to `UNMATCHED` before re-running the dashboard match.
- **UI flow:** `/banking/reconciliation` shows unmatched rows, confidence score, and the best invoice candidate. Hit **Poveži** to accept the top candidate; the dashboard immediately refreshes via SWR.

## Data contracts

- **GET `/api/banking/reconciliation`**  
  Returns `transactions[]` with `confidenceScore`, `matchStatus`, and `candidates[]` (invoice id, number, total, reason, issueDate) plus `summary` counts and `autoMatchThreshold`.
- **POST `/api/banking/reconciliation/match`**  
  Authenticated endpoint that ties a transaction to an invoice and forces the invoice `paidAt`.

## Questions answered

1. **What confidence score auto-approves matches?**  
   Auto-match is locked to scores of 85 or higher, as defined in `AUTO_MATCH_THRESHOLD`.
2. **What amount tolerance do we allow for partial matches?**  
   Amounts can deviate up to 5% when the transaction date is within 5 days.
3. **How do we treat EUR payments for HRK invoices?**  
   Auto-matching currently assumes no FX spread; manual review is required if the currencies differ.
4. **Is there a separate `PAID_VERIFIED` status?**  
   No, we reuse `MatchStatus` with `AUTO_MATCHED`/`MANUAL_MATCHED` tags and update `EInvoice.paidAt`.
5. **Does the dashboard bulk-approve matches?**  
   Not yet; the UI surfaces a single top candidate per line and lets accountants hit “Poveži” per row.
