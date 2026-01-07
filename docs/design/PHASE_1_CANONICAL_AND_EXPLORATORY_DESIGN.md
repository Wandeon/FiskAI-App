# Phase 1: Canonical Concept Set & Exploratory Signal Design

**Status**: Design Document (Pending Review)
**Date**: 2026-01-07
**Author**: Phase-1 Design Architect
**Scope**: Mode 1 canonical concepts, RuleFact envelope, Mode 2 exploratory signals, Assistant policy

---

## Executive Summary

This document defines:

1. A **Mode 1 canonical concept set** of 21 concepts covering ~30% of regulatory concepts but delivering ~90% of user value
2. A **RuleFact envelope** with mandatory grounding and applicability fields
3. A **Mode 2 exploratory signal system** for safe capture of emerging content
4. **Assistant policies** for answering from each mode
5. **Promotion governance** from Mode 2 to Mode 1
6. **Success criteria** for Phase 1 completion

**Non-negotiable principles**:

- Mode 1 remains strict, auditable, and production-safe
- Mode 2 surfaces novelty without polluting canonical truth
- Every fact must be grounded in Evidence
- Temporal validity and applicability are mandatory
- Pillars are presentation, not extraction (unchanged)

---

## Section 1: Mode 1 Canonical Concept Set (The 30%)

### Design Rationale

The canonical set targets concepts that:

- Appear in ≥60% of Croatian regulatory documents monitored
- Answer ≥80% of real user questions (based on FiskAI product research)
- Can be extracted with ≥0.90 confidence with existing grounding validation
- Have clear, stable legal definitions with explicit values

### Canonical Concept Registry (21 Concepts)

---

#### 1.1 PDV (Value Added Tax) — 5 Concepts

| #   | Concept Slug                 | Domain | Description                                                         |
| --- | ---------------------------- | ------ | ------------------------------------------------------------------- |
| 1   | `pdv-standard-rate`          | pdv    | Standard VAT rate applicable to most goods and services             |
| 2   | `pdv-reduced-rate-13`        | pdv    | Reduced VAT rate for specific goods (hospitality, newspapers, etc.) |
| 3   | `pdv-reduced-rate-5`         | pdv    | Super-reduced VAT rate for basic necessities                        |
| 4   | `pdv-registration-threshold` | pdv    | Annual revenue threshold requiring VAT registration                 |
| 5   | `pdv-filing-deadline`        | pdv    | Monthly/quarterly VAT return submission deadline                    |

**Detailed Specification: `pdv-standard-rate`**

| Field                  | Specification                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Concept**            | `pdv-standard-rate`                                                                                                                                   |
| **Domain**             | pdv                                                                                                                                                   |
| **Description**        | The standard rate of value-added tax (PDV) applicable to taxable supplies of goods and services in Croatia unless a reduced rate or exemption applies |
| **Subject**            | PDV obveznik (VAT-registered entity)                                                                                                                  |
| **Object**             | Taxable supply of goods or services                                                                                                                   |
| **Conditions**         | `{ "AND": [{ "entity.vatStatus": "registered" }, { "NOT": { "supply.category": ["reduced_rate", "exempt"] }}]}`                                       |
| **Value Type**         | percentage                                                                                                                                            |
| **Expected Value**     | 25                                                                                                                                                    |
| **Authority**          | LAW                                                                                                                                                   |
| **Legal Reference**    | Zakon o porezu na dodanu vrijednost (NN 73/13, 148/13, 143/14, 115/16, 106/18, 121/19, 138/20, 39/22, 113/22, 33/23, 114/23, 35/25)                   |
| **Grounding Quote(s)** | Must contain exact quote stating "25%" or "dvadeset pet posto"                                                                                        |
| **Feeds Pillar(s)**    | PDV                                                                                                                                                   |
| **Example Documents**  | Zakon o PDV-u čl. 38, Pravilnik o PDV-u, Porezna uprava objašnjenja                                                                                   |

**Detailed Specification: `pdv-registration-threshold`**

| Field                  | Specification                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Concept**            | `pdv-registration-threshold`                                                                       |
| **Domain**             | pdv                                                                                                |
| **Description**        | Annual revenue threshold above which a business must register for VAT                              |
| **Subject**            | Porezni obveznik (any taxable person)                                                              |
| **Object**             | Godišnji promet (annual turnover)                                                                  |
| **Conditions**         | `{ "AND": [{ "entity.type": ["obrt", "doo", "jdoo"] }, { "entity.vatStatus": "not_registered" }]}` |
| **Value Type**         | currency_eur                                                                                       |
| **Expected Value**     | 40000                                                                                              |
| **Authority**          | LAW                                                                                                |
| **Legal Reference**    | Zakon o PDV-u čl. 90                                                                               |
| **Grounding Quote(s)** | Must contain "40.000 EUR" or "40000 eura" or equivalent                                            |
| **Feeds Pillar(s)**    | PDV, Pausalni Obrt                                                                                 |
| **Example Documents**  | Zakon o PDV-u, Porezna uprava - Oporezivanje malih poreznih obveznika                              |

---

#### 1.2 Pausalni Obrt (Flat-Rate Business) — 3 Concepts

| #   | Concept Slug                 | Domain   | Description                                              |
| --- | ---------------------------- | -------- | -------------------------------------------------------- |
| 6   | `pausalni-revenue-threshold` | pausalni | Maximum annual revenue to qualify for flat-rate taxation |
| 7   | `pausalni-tax-rate`          | pausalni | Fixed tax rate for flat-rate businesses                  |
| 8   | `pausalni-contribution-base` | pausalni | Base amount for calculating social contributions         |

**Detailed Specification: `pausalni-revenue-threshold`**

| Field                  | Specification                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Concept**            | `pausalni-revenue-threshold`                                                                                          |
| **Domain**             | pausalni                                                                                                              |
| **Description**        | Maximum annual gross revenue a craft/trade (obrt) can earn while remaining eligible for flat-rate (paušalni) taxation |
| **Subject**            | Obrtnik (sole proprietor / craftsman)                                                                                 |
| **Object**             | Godišnji bruto primitak (annual gross receipts)                                                                       |
| **Conditions**         | `{ "AND": [{ "entity.type": "obrt" }, { "entity.taxRegime": "pausalni" }]}`                                           |
| **Value Type**         | currency_eur                                                                                                          |
| **Expected Value**     | 40000                                                                                                                 |
| **Authority**          | LAW                                                                                                                   |
| **Legal Reference**    | Zakon o porezu na dohodak čl. 82                                                                                      |
| **Grounding Quote(s)** | Must contain "40.000 EUR" or "40.000 eura"                                                                            |
| **Feeds Pillar(s)**    | Pausalni Obrt                                                                                                         |
| **Example Documents**  | Zakon o porezu na dohodak, Porezna uprava - Paušalno oporezivanje                                                     |

---

#### 1.3 Porez na Dohodak (Income Tax) — 4 Concepts

| #   | Concept Slug                      | Domain        | Description                                            |
| --- | --------------------------------- | ------------- | ------------------------------------------------------ |
| 9   | `porez-dohodak-rate-lower`        | porez_dohodak | Lower bracket income tax rate                          |
| 10  | `porez-dohodak-rate-higher`       | porez_dohodak | Higher bracket income tax rate                         |
| 11  | `porez-dohodak-bracket-threshold` | porez_dohodak | Income threshold between lower and higher tax brackets |
| 12  | `porez-dohodak-osobni-odbitak`    | porez_dohodak | Basic personal allowance (tax-free amount)             |

**Detailed Specification: `porez-dohodak-rate-lower`**

| Field                  | Specification                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| **Concept**            | `porez-dohodak-rate-lower`                                                                          |
| **Domain**             | porez_dohodak                                                                                       |
| **Description**        | Income tax rate applicable to annual taxable income below the bracket threshold                     |
| **Subject**            | Fizička osoba (natural person) with taxable income                                                  |
| **Object**             | Godišnja porezna osnovica (annual tax base)                                                         |
| **Conditions**         | `{ "AND": [{ "income.type": "taxable" }, { "income.annual_base": { "lte": "bracket_threshold" }}]}` |
| **Value Type**         | percentage                                                                                          |
| **Expected Value**     | 20                                                                                                  |
| **Authority**          | LAW                                                                                                 |
| **Legal Reference**    | Zakon o porezu na dohodak čl. 24                                                                    |
| **Grounding Quote(s)** | Must contain "20%" or "dvadeset posto"                                                              |
| **Feeds Pillar(s)**    | Porez na Dohodak                                                                                    |
| **Example Documents**  | Zakon o porezu na dohodak, Pravilnik o porezu na dohodak                                            |

**Detailed Specification: `porez-dohodak-osobni-odbitak`**

| Field                  | Specification                                                           |
| ---------------------- | ----------------------------------------------------------------------- |
| **Concept**            | `porez-dohodak-osobni-odbitak`                                          |
| **Domain**             | porez_dohodak                                                           |
| **Description**        | Basic personal allowance - tax-free amount deducted from taxable income |
| **Subject**            | Porezni obveznik (taxpayer)                                             |
| **Object**             | Mjesečna/godišnja porezna osnovica                                      |
| **Conditions**         | `{ "entity.type": "fizicka_osoba" }`                                    |
| **Value Type**         | currency_eur                                                            |
| **Expected Value**     | 560 (monthly)                                                           |
| **Authority**          | LAW                                                                     |
| **Legal Reference**    | Zakon o porezu na dohodak čl. 14                                        |
| **Grounding Quote(s)** | Must contain "560" or equivalent monthly/annual amount                  |
| **Feeds Pillar(s)**    | Porez na Dohodak                                                        |
| **Example Documents**  | Zakon o porezu na dohodak, Porezna uprava - Osobni odbitak              |

---

#### 1.4 Doprinosi (Social Contributions) — 5 Concepts

| #   | Concept Slug               | Domain    | Description                             |
| --- | -------------------------- | --------- | --------------------------------------- |
| 13  | `doprinosi-health-rate`    | doprinosi | Health insurance contribution rate      |
| 14  | `doprinosi-pension-1-rate` | doprinosi | First pillar pension contribution rate  |
| 15  | `doprinosi-pension-2-rate` | doprinosi | Second pillar pension contribution rate |
| 16  | `doprinosi-base-minimum`   | doprinosi | Minimum contribution base               |
| 17  | `doprinosi-base-maximum`   | doprinosi | Maximum contribution base               |

**Detailed Specification: `doprinosi-health-rate`**

| Field                  | Specification                                                             |
| ---------------------- | ------------------------------------------------------------------------- |
| **Concept**            | `doprinosi-health-rate`                                                   |
| **Domain**             | doprinosi                                                                 |
| **Description**        | Contribution rate for mandatory health insurance (zdravstveno osiguranje) |
| **Subject**            | Poslodavac or Osiguranik (employer or insured person)                     |
| **Object**             | Bruto plaća or Osnovica (gross salary or contribution base)               |
| **Conditions**         | `{ "entity.employment_status": ["employed", "self_employed"] }`           |
| **Value Type**         | percentage                                                                |
| **Expected Value**     | 16.5                                                                      |
| **Authority**          | LAW                                                                       |
| **Legal Reference**    | Zakon o doprinosima čl. 13                                                |
| **Grounding Quote(s)** | Must contain "16,5%" or "16.5%"                                           |
| **Feeds Pillar(s)**    | Doprinosi                                                                 |
| **Example Documents**  | Zakon o doprinosima, HZZO upute                                           |

**Detailed Specification: `doprinosi-pension-1-rate`**

| Field                  | Specification                                                    |
| ---------------------- | ---------------------------------------------------------------- |
| **Concept**            | `doprinosi-pension-1-rate`                                       |
| **Domain**             | doprinosi                                                        |
| **Description**        | First pillar (generational solidarity) pension contribution rate |
| **Subject**            | Osiguranik (insured person)                                      |
| **Object**             | Bruto plaća (gross salary)                                       |
| **Conditions**         | `{ "entity.pension_pillar_2": true }`                            |
| **Value Type**         | percentage                                                       |
| **Expected Value**     | 15                                                               |
| **Authority**          | LAW                                                              |
| **Legal Reference**    | Zakon o doprinosima čl. 12                                       |
| **Grounding Quote(s)** | Must contain "15%" or "petnaest posto" for I. stup               |
| **Feeds Pillar(s)**    | Doprinosi                                                        |
| **Example Documents**  | Zakon o doprinosima, HZMO upute                                  |

---

#### 1.5 Rokovi (Deadlines) — 3 Concepts

| #   | Concept Slug              | Domain | Description                        |
| --- | ------------------------- | ------ | ---------------------------------- |
| 18  | `rokovi-pdv-monthly`      | rokovi | Monthly VAT return filing deadline |
| 19  | `rokovi-joppd`            | rokovi | JOPPD form submission deadline     |
| 20  | `rokovi-godisnja-prijava` | rokovi | Annual tax return filing deadline  |

**Detailed Specification: `rokovi-pdv-monthly`**

| Field                  | Specification                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Concept**            | `rokovi-pdv-monthly`                                                                  |
| **Domain**             | rokovi                                                                                |
| **Description**        | Deadline for submitting monthly VAT return (PDV obrazac)                              |
| **Subject**            | PDV obveznik (VAT-registered entity)                                                  |
| **Object**             | PDV prijava za prethodni mjesec                                                       |
| **Conditions**         | `{ "AND": [{ "entity.vatStatus": "registered" }, { "entity.vatPeriod": "monthly" }]}` |
| **Value Type**         | deadline_day                                                                          |
| **Expected Value**     | 20 (20th of following month)                                                          |
| **Authority**          | LAW                                                                                   |
| **Legal Reference**    | Zakon o PDV-u čl. 85                                                                  |
| **Grounding Quote(s)** | Must contain "do 20." or "najkasnije do 20. dana"                                     |
| **Feeds Pillar(s)**    | Rokovi, PDV                                                                           |
| **Example Documents**  | Zakon o PDV-u, Pravilnik o PDV-u                                                      |

**Detailed Specification: `rokovi-joppd`**

| Field                  | Specification                                         |
| ---------------------- | ----------------------------------------------------- |
| **Concept**            | `rokovi-joppd`                                        |
| **Domain**             | rokovi                                                |
| **Description**        | Deadline for submitting JOPPD form (payroll report)   |
| **Subject**            | Poslodavac or Isplatitelj (employer or payer)         |
| **Object**             | JOPPD obrazac                                         |
| **Conditions**         | `{ "entity.has_employees": true }`                    |
| **Value Type**         | deadline_description                                  |
| **Expected Value**     | "najkasnije do 15. u mjesecu za prethodni mjesec"     |
| **Authority**          | LAW                                                   |
| **Legal Reference**    | Pravilnik o porezu na dohodak čl. 79                  |
| **Grounding Quote(s)** | Must contain "15." or deadline specification          |
| **Feeds Pillar(s)**    | Rokovi, Obrasci                                       |
| **Example Documents**  | Pravilnik o porezu na dohodak, Porezna uprava - JOPPD |

---

#### 1.6 Fiskalizacija (Fiscal Registers) — 1 Concept

| #   | Concept Slug           | Domain        | Description                               |
| --- | ---------------------- | ------------- | ----------------------------------------- |
| 21  | `fiskalizacija-obveza` | fiskalizacija | Obligation to fiscalize cash transactions |

**Detailed Specification: `fiskalizacija-obveza`**

| Field                  | Specification                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| **Concept**            | `fiskalizacija-obveza`                                                                     |
| **Domain**             | fiskalizacija                                                                              |
| **Description**        | Legal obligation to fiscalize (report) cash transactions to the Tax Authority in real-time |
| **Subject**            | Obveznik fiskalizacije (any business accepting cash payments)                              |
| **Object**             | Gotovinski promet (cash transactions)                                                      |
| **Conditions**         | `{ "AND": [{ "entity.accepts_cash": true }, { "entity.type": ["obrt", "doo", "jdoo"] }]}`  |
| **Value Type**         | boolean                                                                                    |
| **Expected Value**     | true                                                                                       |
| **Authority**          | LAW                                                                                        |
| **Legal Reference**    | Zakon o fiskalizaciji u prometu gotovinom (NN 133/12)                                      |
| **Grounding Quote(s)** | Must reference fiscalization obligation                                                    |
| **Feeds Pillar(s)**    | Fiskalizacija                                                                              |
| **Example Documents**  | Zakon o fiskalizaciji, Porezna uprava - Fiskalizacija                                      |

---

### Concept Coverage Summary

| Domain        | Count  | Coverage                                       |
| ------------- | ------ | ---------------------------------------------- |
| pdv           | 5      | VAT rates, thresholds, deadlines               |
| pausalni      | 3      | Revenue threshold, tax rate, contribution base |
| porez_dohodak | 4      | Tax rates, brackets, personal allowance        |
| doprinosi     | 5      | Health, pension, contribution bases            |
| rokovi        | 3      | PDV, JOPPD, annual return deadlines            |
| fiskalizacija | 1      | Core obligation                                |
| **Total**     | **21** | **~90% of user questions**                     |

---

## Section 2: RuleFact Envelope (Mode 1)

### RuleFact Structure Definition

```
RuleFact {
  // === IDENTIFICATION ===
  id:                 String (cuid)           REQUIRED, system-generated
  conceptSlug:        String                  REQUIRED, from Canonical Registry

  // === APPLICABILITY (WHO/WHAT/WHEN) ===
  subject: {
    type:             SubjectType             REQUIRED
    description:      String                  REQUIRED, Croatian
    constraints:      AppliesWhenDSL          OPTIONAL
  }

  object: {
    type:             ObjectType              REQUIRED
    description:      String                  REQUIRED, Croatian
    constraints:      AppliesWhenDSL          OPTIONAL
  }

  conditions:         AppliesWhenDSL          REQUIRED, never empty (use "{ \"always\": true }")

  // === VALUE ===
  value:              String                  REQUIRED
  valueType:          ValueType               REQUIRED
  displayValue:       String                  REQUIRED, human-readable

  // === TEMPORAL VALIDITY ===
  effectiveFrom:      DateTime                REQUIRED, inclusive
  effectiveUntil:     DateTime | null         REQUIRED, null = ongoing, explicit "unknown" not allowed

  // === AUTHORITY ===
  authority:          AuthorityLevel          REQUIRED (LAW | GUIDANCE | PROCEDURE | PRACTICE)
  legalReference: {
    law:              String                  REQUIRED, law name with NN reference
    article:          String                  OPTIONAL, article number
    paragraph:        String                  OPTIONAL, paragraph number
    officialUrl:      String                  OPTIONAL, URL to official source
  }

  // === GROUNDING (MANDATORY) ===
  groundingQuotes: [                          REQUIRED, min 1
    {
      evidenceId:     String                  REQUIRED, FK to Evidence
      exactQuote:     String                  REQUIRED, verbatim from source
      quoteLocation: {
        startOffset:  Int                     REQUIRED
        endOffset:    Int                     REQUIRED
      }
      matchType:      MatchType               REQUIRED (EXACT | NORMALIZED)
    }
  ]

  // === METADATA ===
  riskTier:           RiskTier                REQUIRED (T0 | T1 | T2 | T3)
  confidence:         Float                   REQUIRED, 0.0-1.0, min 0.90 for Mode 1
  status:             RuleStatus              REQUIRED
  createdAt:          DateTime                REQUIRED
  updatedAt:          DateTime                REQUIRED
}
```

### Field Types

```
SubjectType =
  | "pdv_obveznik"           // VAT-registered entity
  | "porezni_obveznik"       // Any taxpayer
  | "obrtnik"                // Sole proprietor
  | "pravna_osoba"           // Legal entity (d.o.o., d.d., etc.)
  | "fizicka_osoba"          // Natural person
  | "poslodavac"             // Employer
  | "osiguranik"             // Insured person
  | "obveznik_fiskalizacije" // Entity subject to fiscalization

ObjectType =
  | "porezna_stopa"          // Tax rate
  | "prag_prihoda"           // Revenue threshold
  | "osnovica"               // Tax/contribution base
  | "rok"                    // Deadline
  | "obveza"                 // Obligation (boolean)
  | "iznos"                  // Amount
  | "postotak"               // Percentage

ValueType =
  | "percentage"             // e.g., 25 (means 25%)
  | "currency_eur"           // e.g., 40000 (means 40,000 EUR)
  | "currency_hrk"           // Legacy, converted to EUR
  | "deadline_day"           // e.g., 20 (means 20th day of month)
  | "deadline_description"   // e.g., "15 dana od isplate"
  | "boolean"                // true/false
  | "count"                  // Integer count

AuthorityLevel =
  | "LAW"                    // Zakon, binding
  | "GUIDANCE"               // Porezna uprava tumačenje
  | "PROCEDURE"              // Pravilnik, procedural
  | "PRACTICE"               // Ustaljenja praksa

MatchType =
  | "EXACT"                  // Quote found byte-for-byte
  | "NORMALIZED"             // Quote found after whitespace/diacritic normalization

RiskTier =
  | "T0"                     // Critical: rates, penalties
  | "T1"                     // High: thresholds, bases
  | "T2"                     // Medium: procedures
  | "T3"                     // Low: labels, help text
```

### Validation Rules (Rejection Triggers)

| Rule                                    | Rejection Reason     | Example                           |
| --------------------------------------- | -------------------- | --------------------------------- |
| `conceptSlug` not in Canonical Registry | `INVALID_CONCEPT`    | `conceptSlug: "unknown-tax"`      |
| `subject.type` not in SubjectType       | `INVALID_SUBJECT`    | `subject.type: "company"`         |
| `conditions` is empty or null           | `MISSING_CONDITIONS` | `conditions: null`                |
| `effectiveFrom` missing                 | `MISSING_TEMPORAL`   | `effectiveFrom: null`             |
| `effectiveUntil` is string "unknown"    | `AMBIGUOUS_TEMPORAL` | `effectiveUntil: "unknown"`       |
| `authority` missing                     | `MISSING_AUTHORITY`  | `authority: null`                 |
| `legalReference.law` missing            | `MISSING_LEGAL_REF`  | `legalReference: {}`              |
| `groundingQuotes` empty                 | `NO_GROUNDING`       | `groundingQuotes: []`             |
| Quote not found in Evidence             | `GROUNDING_MISMATCH` | Quote doesn't exist in rawContent |
| `confidence` < 0.90                     | `LOW_CONFIDENCE`     | `confidence: 0.75`                |
| Value not found in quote                | `VALUE_NOT_GROUNDED` | Value "25" not in exactQuote      |

### What Mode 1 Will NEVER Accept

| Rejection                              | Rationale                                            |
| -------------------------------------- | ---------------------------------------------------- |
| Facts without grounding quotes         | No verifiable source = potential hallucination       |
| Facts with `effectiveUntil: "unknown"` | Temporal validity must be explicit or null (ongoing) |
| Facts outside Canonical Registry       | Prevents concept drift and maintains auditability    |
| Facts with confidence < 0.90           | High-confidence requirement for production safety    |
| Facts with inferred values             | Value must appear verbatim in quote                  |
| Facts without legal reference          | Regulatory facts must cite legal basis               |
| Facts with NORMALIZED match for T0/T1  | Critical facts require EXACT quote match             |

### Temporal Validity Enforcement

**Rules**:

1. `effectiveFrom` is **INCLUSIVE** - fact applies ON this date
2. `effectiveUntil` is **EXCLUSIVE** - fact does NOT apply ON this date
3. `effectiveUntil = null` means "ongoing until superseded"
4. Query evaluation: `effectiveFrom <= asOfDate AND (effectiveUntil IS NULL OR effectiveUntil > asOfDate)`

**Conflict Resolution (Newer Overrides Older)**:

1. Same `conceptSlug`, overlapping temporal validity → conflict
2. Resolution order:
   - Higher `authority` wins (LAW > GUIDANCE > PROCEDURE > PRACTICE)
   - If same authority, more recent `effectiveFrom` wins
   - If same date, deterministic tie-breaker (lower ID wins)
3. Losing fact marked `DEPRECATED`, supersession chain recorded

---

## Section 3: Mode 2 Exploratory Signal Design

### Purpose

Mode 2 captures regulatory content that:

- Falls outside the Canonical Registry
- Lacks sufficient grounding for Mode 1
- Represents emerging or novel regulatory concepts
- Requires human review before promotion

### CandidateFact Structure

```
CandidateFact {
  // === IDENTIFICATION ===
  id:                   String (cuid)         REQUIRED, system-generated
  suggestedConceptSlug: String | null         OPTIONAL, LLM suggestion (not validated)
  suggestedDomain:      String | null         OPTIONAL, LLM guess

  // === APPLICABILITY (PARTIAL) ===
  subject: {
    description:        String | null         OPTIONAL
    confidence:         Float                 REQUIRED, 0.0-1.0
  }

  object: {
    description:        String | null         OPTIONAL
    confidence:         Float                 REQUIRED, 0.0-1.0
  }

  conditions:           String | null         OPTIONAL, raw text (not DSL)
  conditionsConfidence: Float                 REQUIRED, 0.0-1.0

  // === VALUE ===
  extractedValue:       String | null         OPTIONAL
  suggestedValueType:   String | null         OPTIONAL, LLM guess
  valueConfidence:      Float                 REQUIRED, 0.0-1.0

  // === TEMPORAL (PARTIAL) ===
  effectiveFrom:        DateTime | null       OPTIONAL, may be missing
  effectiveUntil:       DateTime | null       OPTIONAL
  temporalConfidence:   Float                 REQUIRED, 0.0-1.0
  temporalNotes:        String | null         OPTIONAL, why uncertain

  // === AUTHORITY (PARTIAL) ===
  suggestedAuthority:   String | null         OPTIONAL
  legalReferenceRaw:    String | null         OPTIONAL, unstructured

  // === GROUNDING (MANDATORY) ===
  groundingQuotes: [                          REQUIRED, min 1 (same as Mode 1)
    {
      evidenceId:       String                REQUIRED
      exactQuote:       String                REQUIRED
      quoteLocation: {
        startOffset:    Int                   OPTIONAL (may fail to locate)
        endOffset:      Int                   OPTIONAL
      }
      matchType:        MatchType | null      OPTIONAL (may be NOT_FOUND)
    }
  ]

  // === METADATA ===
  status:               CandidateStatus       REQUIRED
  overallConfidence:    Float                 REQUIRED, 0.0-1.0
  extractorNotes:       String | null         OPTIONAL, LLM reasoning
  reviewNotes:          String | null         OPTIONAL, human notes
  createdAt:            DateTime              REQUIRED
  reviewedAt:           DateTime | null       OPTIONAL
  reviewedBy:           String | null         OPTIONAL

  // === SUGGESTION ===
  suggestedPillar:      String | null         OPTIONAL, for presentation routing
  promotionCandidate:   Boolean               REQUIRED, false by default
}
```

### CandidateStatus Values

```
CandidateStatus =
  | "CAPTURED"          // Initial extraction, awaiting review
  | "UNDER_REVIEW"      // Human is reviewing
  | "NEEDS_EVIDENCE"    // Grounding insufficient, needs more sources
  | "PROMOTABLE"        // Ready for Mode 1 promotion (pending governance)
  | "REJECTED"          // Not valid regulatory content
  | "PROMOTED"          // Successfully promoted to Mode 1
  | "ARCHIVED"          // No longer relevant
```

### Allowed vs Prohibited in Mode 2

| Allowed                                        | Prohibited                                 |
| ---------------------------------------------- | ------------------------------------------ |
| Missing `effectiveFrom` (with `temporalNotes`) | Empty `groundingQuotes`                    |
| Missing `subject` or `object`                  | Claims without any quote                   |
| Low confidence (< 0.90)                        | Duplicate of existing Mode 1 fact          |
| Unknown domain suggestions                     | Silent promotion to Mode 1                 |
| Unstructured `conditions`                      | Direct use by Assistant without disclaimer |
| NOT_FOUND match type                           | Modification of Evidence                   |

### Grounding Requirements for Mode 2

Even exploratory signals MUST have:

1. At least one `groundingQuote` with `evidenceId` and `exactQuote`
2. The quote MUST exist in the referenced Evidence (verified)
3. If quote cannot be located, `matchType: null` with explanation

**What Mode 2 explicitly must NOT do**:

- Make truth claims usable by Assistant without explicit uncertainty markers
- Auto-promote to Mode 1 without human governance
- Allow "probably" or "likely" without grounding
- Store hallucinated content (even as exploratory)

---

## Section 4: Assistant Policy (Mode 1 vs Mode 2)

### Mode 1 Answer Policy

**When answering from Mode 1 RuleFacts**:

| Aspect                 | Policy                          |
| ---------------------- | ------------------------------- |
| **Tone**               | Confident, declarative          |
| **Certainty**          | High - "The VAT rate is 25%"    |
| **Citation**           | Required - always show source   |
| **Legal Reference**    | Required - cite law and article |
| **Temporal Context**   | Required - state effectiveFrom  |
| **Confidence Display** | Not shown (implied high)        |

**Example Mode 1 Answer**:

```
User: "Kolika je stopa PDV-a?"
Assistant: "Standardna stopa PDV-a iznosi 25%."

**Izvor**: Zakon o porezu na dodanu vrijednost, cl. 38
**Vrijedi od**: 1. sijecnja 2013.
```

### Mode 2 Answer Policy

**When answering from Mode 2 CandidateFacts**:

| Aspect                 | Policy                                       |
| ---------------------- | -------------------------------------------- |
| **Tone**               | Cautious, hedged                             |
| **Certainty**          | Low - "According to preliminary analysis..." |
| **Citation**           | Required - show source AND uncertainty       |
| **Legal Reference**    | Show if available, mark if uncertain         |
| **Temporal Context**   | Show if available, mark if uncertain         |
| **Confidence Display** | Required - show confidence percentage        |
| **Disclaimer**         | Required - explicit uncertainty warning      |

**Example Mode 2 Answer**:

```
User: "Postoje li novi rokovi za e-racune?"
Assistant: "Pronasao sam informacije o e-racunima, ali uz odredene napomene:

Prema preliminarnoj analizi nasih izvora, cini se da postoje novi rokovi
za implementaciju e-racuna za B2G transakcije.

**VAZNA NAPOMENA**: Ova informacija dolazi iz neprovjerenog izvora i
ima nisku pouzdanost (65%). Preporucam provjeru s Poreznom upravom
prije donosenja odluka.

**Izvor**: Dokument u pregledu (nije sluzbeno potvrdeno)
**Pouzdanost**: 65%"
```

### Assistant Decision Matrix

| Query Type        | Mode 1 Available | Mode 2 Available | Response Strategy                   |
| ----------------- | ---------------- | ---------------- | ----------------------------------- |
| Exact fact query  | Yes              | -                | Use Mode 1, confident answer        |
| Exact fact query  | No               | Yes              | Use Mode 2 with disclaimer          |
| Exact fact query  | No               | No               | "Nemam informacija o tome"          |
| Exploratory query | Yes              | Yes              | Mode 1 first, mention Mode 2 exists |
| Exploratory query | No               | Yes              | Mode 2 with strong disclaimer       |
| Calculation query | Yes (inputs)     | -                | Calculate from Mode 1 facts         |

### Prohibited Assistant Behaviors

| Behavior                               | Why Prohibited               |
| -------------------------------------- | ---------------------------- |
| Mixing Mode 1 and Mode 2 in same claim | Confuses certainty level     |
| Omitting disclaimer for Mode 2         | User assumes high confidence |
| Stating Mode 2 as fact                 | Violates truth integrity     |
| Calculating from Mode 2 inputs         | Propagates uncertainty       |
| Ignoring temporal validity             | May provide outdated info    |

---

## Section 5: Promotion & Evolution Loop

### Promotion Governance

**Promotion from Mode 2 to Mode 1 requires**:

1. **Evidence Threshold**
   - Minimum 2 independent Evidence sources
   - All quotes verified in source documents
   - No conflicting extractions

2. **Confidence Threshold**
   - Overall confidence >= 0.90
   - Temporal confidence >= 0.95
   - Value confidence >= 0.95

3. **Human Review**
   - Domain expert approval required
   - Legal reference verified against official source
   - Concept slug approved for Canonical Registry

4. **Governance Record**
   - Promotion request logged
   - Reviewer identity recorded
   - Approval timestamp recorded
   - Original CandidateFact preserved

### Promotion Workflow

```
CandidateFact (CAPTURED)
    |
    v
[Automated Scoring]
    |
    +--> confidence < 0.85 --> NEEDS_EVIDENCE
    |
    +--> confidence >= 0.85 --> UNDER_REVIEW
                                    |
                                    v
                            [Human Review]
                                    |
    +-------------------------------+-------------------------------+
    |                               |                               |
    v                               v                               v
REJECTED                      PROMOTABLE                     NEEDS_EVIDENCE
(invalid content)          (ready for promotion)          (insufficient grounding)
                                    |
                                    v
                        [Governance Approval]
                                    |
                                    v
                               PROMOTED
                                    |
                                    v
                            [Create RuleFact]
                                    |
                                    v
                            Mode 1 RuleFact
```

### Canonical Registry Evolution

**Adding New Concepts to Canonical Registry**:

| Step | Action           | Requirement                                   |
| ---- | ---------------- | --------------------------------------------- |
| 1    | Identify pattern | 5+ CandidateFacts with same suggested domain  |
| 2    | Define concept   | Slug, description, value type, expected range |
| 3    | Verify grounding | All existing CandidateFacts have valid quotes |
| 4    | Expert approval  | Domain expert signs off on concept definition |
| 5    | Registry update  | Add to Canonical Concept Registry             |
| 6    | Batch promotion  | Promote qualifying CandidateFacts to Mode 1   |

**Concept Retirement**:

| Step | Action                | Requirement                      |
| ---- | --------------------- | -------------------------------- |
| 1    | Identify obsolescence | Law repealed or replaced         |
| 2    | Mark deprecated       | Set all RuleFacts to DEPRECATED  |
| 3    | Temporal close        | Set effectiveUntil on all facts  |
| 4    | Registry archive      | Move concept to archived section |

### Feedback Loop: Mode 2 Signals Informing Mode 1

```
Mode 2 CandidateFacts
    |
    v
[Pattern Detection]
    |
    +--> Cluster by suggestedDomain
    |
    +--> Identify high-frequency concepts
    |
    v
[Registry Review Queue]
    |
    v
[Monthly Governance Meeting]
    |
    +--> Approve new concepts
    |
    +--> Reject noise patterns
    |
    v
Canonical Registry Updated
```

---

## Section 6: Success Criteria

### Phase 1 Completion Criteria

| Criterion                      | Target | Measurement                |
| ------------------------------ | ------ | -------------------------- |
| Canonical concepts defined     | 21     | Count in registry          |
| RuleFact schema validated      | 100%   | All fields documented      |
| CandidateFact schema validated | 100%   | All fields documented      |
| Assistant policy documented    | 100%   | Mode 1 and Mode 2 covered  |
| Promotion workflow defined     | 100%   | All states and transitions |
| Success criteria defined       | 100%   | This section complete      |

### Design Quality Gates

| Gate                      | Requirement                                        | Status |
| ------------------------- | -------------------------------------------------- | ------ |
| No implementation details | Design only                                        | PASS   |
| No code artifacts         | Docs only                                          | PASS   |
| Grounding mandatory       | Both modes require quotes                          | PASS   |
| Temporal validity         | effectiveFrom required                             | PASS   |
| Authority hierarchy       | LAW > GUIDANCE > PROCEDURE > PRACTICE              | PASS   |
| Mode separation           | No Mode 2 in production answers without disclaimer | PASS   |

### Measurable Outcomes for Implementation

When this design is implemented, the following should be measurable:

| Metric                       | Target                  | How Measured                            |
| ---------------------------- | ----------------------- | --------------------------------------- |
| Mode 1 extraction accuracy   | >= 95%                  | Manual audit of 100 random RuleFacts    |
| Mode 2 capture rate          | >= 80% of novel content | Comparison with manual extraction       |
| Grounding verification rate  | 100%                    | Automated quote-in-evidence check       |
| False positive rate (Mode 1) | < 1%                    | Manual verification of random sample    |
| Promotion success rate       | >= 70%                  | CandidateFacts reaching PROMOTED status |
| User confidence in Mode 1    | >= 90%                  | User survey on answer reliability       |

### Non-Goals (Explicitly Out of Scope)

| Non-Goal               | Rationale                       |
| ---------------------- | ------------------------------- |
| Implementation code    | Design phase only               |
| Database schema        | Deferred to implementation      |
| API endpoints          | Deferred to implementation      |
| UI/UX design           | Separate design phase           |
| Performance benchmarks | Requires implementation         |
| Migration strategy     | Requires existing data analysis |

---

## Appendix A: Glossary

| Term                   | Definition                                                           |
| ---------------------- | -------------------------------------------------------------------- |
| **Mode 1**             | Canonical, high-confidence regulatory facts with strict grounding    |
| **Mode 2**             | Exploratory signals for novel content requiring human review         |
| **RuleFact**           | Mode 1 fact structure with mandatory grounding and temporal validity |
| **CandidateFact**      | Mode 2 signal structure with partial confidence scores               |
| **Canonical Registry** | The 21 approved concepts for Mode 1 extraction                       |
| **Grounding**          | Evidence-backed quotes verifying extracted facts                     |
| **Pillar**             | Presentation category (PDV, Doprinosi, etc.) - unchanged             |
| **Domain**             | Extraction category (pdv, pausalni, etc.)                            |

---

## Appendix B: Change Log

| Date       | Version | Change                  |
| ---------- | ------- | ----------------------- |
| 2026-01-07 | 1.0     | Initial design document |

---

## References

- Phase 0 Exploration Documents: `docs/design/exploration/`
- Product Bible: `docs/product-bible/00-INDEX.md`
- Regulatory Truth Layer Architecture: `docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md`
- Prisma Schema: `prisma/schema.prisma`
