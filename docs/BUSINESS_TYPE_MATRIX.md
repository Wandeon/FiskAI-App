# FiskAI — Business Type Requirements Matrix

**Source of truth:** `docs/MODULE_ANALYSIS.md` (module scope + current implementation status)

## Legend

- ✅ = implemented enough to serve
- ⚠️ = partial / needs work
- ❌ = missing
- ➖ = not required for this business type
- ◻️ = optional (nice-to-have)

## At-a-Glance Coverage (Modules × Business Types)

| Module             | Paušalni obrt | Obrt (dohodak)    | d.o.o. / j.d.o.o. | Notes                                         |
| ------------------ | ------------- | ----------------- | ----------------- | --------------------------------------------- |
| **Invoicing**      | ✅            | ✅                | ✅                | ~80% (polish remaining)                       |
| **Fiscalization**  | ⚠️ (if cash)  | ⚠️ (if cash)      | ⚠️ (if cash)      | ~60% (FINA cert + CIS connection missing)     |
| **KPR**            | ✅            | ➖                | ➖                | 100% complete                                 |
| **KPI**            | ➖            | ❌                | ➖                | 0% (critical blocker for dohodak)             |
| **PO‑SD**          | ✅            | ➖                | ➖                | 100% complete                                 |
| **PDV (forms)**    | ➖            | ⚠️ (if VAT)       | ⚠️                | ~40% partial (critical for d.o.o. + VAT obrt) |
| **JOPPD**          | ➖            | ❌ (if employees) | ❌ (if employees) | 0%                                            |
| **URA/IRA**        | ➖            | ⚠️                | ⚠️                | ~30% partial (report generator missing)       |
| **Travel (Locco)** | ◻️            | ◻️                | ◻️                | 0% (premium)                                  |
| **Assets (DI)**    | ➖            | ❌                | ❌                | 0% (critical for dohodak + d.o.o.)            |

---

## What You Have vs What You Need (per business type)

### 1) Paušalni obrt

| Have today                            | Need to fully satisfy                                         |
| ------------------------------------- | ------------------------------------------------------------- |
| ✅ Invoicing (PDF, email, 2D barcode) | ⚠️ Fiscalization for cash (FINA cert upload + CIS connection) |
| ✅ KPR (Knjiga prometa)               | ⚠️ Invoicing polish (prod PDF download, delivery tracking)    |
| ✅ PO‑SD generator + export           | ⚠️ “Nije u sustavu PDV-a” clause automation                   |

**Result:** Ready for beta for non-cash (or via intermediary). Cash fiscalization completion is the main gate.

---

### 2) Obrt (dohodak)

| Have today                 | Need to fully satisfy                  |
| -------------------------- | -------------------------------------- |
| ✅ Invoicing (core)        | ❌ KPI (Knjiga primitaka/izdataka)     |
| ⚠️ URA/IRA (partial)       | ⚠️ URA/IRA report generators + exports |
| ⚠️ Fiscalization (if cash) | ❌ Assets (DI) + depreciation          |
| ⚠️ PDV (if VAT)            | ⚠️ Full PDV forms if VAT               |
| ➖                         | ❌ JOPPD if employees                  |

**Result:** Not ready yet. KPI + Assets + URA/IRA reporting are the hard blockers.

---

### 3) d.o.o. / j.d.o.o.

| Have today                 | Need to fully satisfy                             |
| -------------------------- | ------------------------------------------------- |
| ✅ Invoicing (core)        | ⚠️ URA/IRA report generators + exports (critical) |
| ⚠️ Fiscalization (if cash) | ❌ Assets (DI) + depreciation (critical)          |
| ⚠️ PDV (partial)           | ⚠️ Full PDV forms (critical)                      |
| ➖                         | ❌ JOPPD if employees                             |
| ◻️ Travel orders (Locco)   | ◻️ Premium (travel + payroll UX)                  |

**Result:** Not ready yet. URA/IRA + Assets + full PDV are the main gates.
