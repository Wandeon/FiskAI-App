# Registration & Onboarding Redesign

> Design document for simplified registration flow with business-type routing
>
> Created: 2026-01-22
> Status: Ready for implementation

## Problem Statement

Current registration offers granular business types (Paušalni obrt, Obrt u sustavu PDV-a, d.o.o.) but:

1. Creates Company records at registration → abandoned/partial companies in DB
2. Routes users to unsupported product paths (only Paušalni is fully supported)
3. Document upload (Obrtnica) appears AFTER manual data entry, defeating its purpose
4. Users see old 6-step wizard before reaching the optimized paušalni flow

## Design Goals

1. **No junk companies** — Create Company only at final confirmation
2. **Document-first UX** — Obrtnica upload before manual fields
3. **Hard gating** — Don't onboard into unsupported products
4. **Single entry point** — One `/onboarding` route that branches internally
5. **Deterministic redirects** — Clear state machine, no "full UI briefly" glitches

---

## Registration Flow

### Registration Form Changes

**Current options (remove):**

- Paušalni obrt
- Obrt u sustavu PDV-a
- d.o.o.

**New options (mandatory field):**

- **Obrt** — "Samostalna djelatnost"
- **Društvo** — "j.d.o.o. ili d.o.o."

**On submit:**

- Create `User` with `registrationIntent` field
- Do NOT create Company or CompanyUser

### Schema Changes

```prisma
enum RegistrationIntent {
  OBRT
  DRUSTVO
}

model User {
  // ... existing fields
  registrationIntent    RegistrationIntent?
  intentChosenAt        DateTime?           // For drop-off analytics
}
```

---

## Onboarding Flow

### Single Entry Point: `/onboarding`

```
┌─────────────────────────────────────────────────────────────────────┐
│  /onboarding                                                        │
│                                                                      │
│  1. Read user.registrationIntent                                    │
│                                                                      │
│  ┌─ intent = null ────────────────────────────────────────────────┐ │
│  │  Show intent selector:                                          │ │
│  │  "Koju vrstu poslovanja imate?"                                 │ │
│  │  ○ Obrt (samostalna djelatnost)                                 │ │
│  │  ○ Društvo (j.d.o.o. / d.o.o.)                                  │ │
│  │  [Save to user.registrationIntent, continue]                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─ intent = DRUSTVO ─────────────────────────────────────────────┐ │
│  │  Show gating screen:                                            │ │
│  │  "Podrška za društva dolazi uskoro"                             │ │
│  │  [Join waitlist: email capture]                                 │ │
│  │  [Change selection: back to intent selector]                    │ │
│  │  DO NOT create Company                                          │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─ intent = OBRT ────────────────────────────────────────────────┐ │
│  │  Step 1: Document Upload + Basic Info                           │ │
│  │  Step 2: Tax Regime Selection                                   │ │
│  │  Step 3+: Paušalni flow OR gating for unsupported               │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Obrt Flow Detail

**Step 1: Podaci o obrtu (Document-First)**

```
┌─────────────────────────────────────────┐
│  Korak 1: Podaci o obrtu                │
├─────────────────────────────────────────┤
│                                         │
│  📄 Učitaj Obrtnicu                     │
│  ┌─────────────────────────────────┐    │
│  │  [Drag & drop or browse]        │    │
│  │  Automatski ćemo prepoznati     │    │
│  │  vaše podatke                   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ─────── ili unesite ručno ───────      │
│                                         │
│  OIB: [___________] (prefilled if OCR)  │
│  Naziv obrta: [___________]             │
│  Adresa: [___________]                  │
│  Datum osnivanja: [___________]         │
│                                         │
│  [Dalje →]                              │
└─────────────────────────────────────────┘
```

**OCR Behavior (non-blocking):**

- Manual fields always visible and editable
- OCR results are **suggestions** — user must confirm
- Store: `extractedValues`, `confidence`, `sourceDocRef` for audit
- OCR failure shows toast, user continues with manual entry

**Step 2: Porezni režim**

```
┌─────────────────────────────────────────┐
│  Korak 2: Porezni režim                 │
├─────────────────────────────────────────┤
│  Kako se oporezuje vaš obrt?            │
│                                         │
│  ● Paušalni obrt                        │
│    Paušalno oporezivanje do €60.000     │
│                                         │
│  ○ Obrt na dohodak (uskoro)             │
│    Stvarni prihodi i rashodi            │
│    [Disabled, shows "Uskoro dostupno"]  │
│                                         │
│  ○ Obrt u sustavu PDV-a (uskoro)        │
│    Obveznik PDV-a                       │
│    [Disabled, shows "Uskoro dostupno"]  │
│                                         │
│  [← Natrag]  [Dalje →]                  │
└─────────────────────────────────────────┘
```

**If Dohodak/PDV selected:** Show waitlist capture, do not proceed.

**Step 3+: Paušalni Flow (existing)**

Route to existing paušalni wizard:

- Step 2: Situacija (employedElsewhere, acceptsCash, isVatPayer, expectedIncome)
- Step 3: Setup (IBAN, email, fiscalization)
- Final confirmation → Create Company

---

## Company Creation (Final Step Only)

### Transaction Requirements

Company is created **only when ALL conditions are met:**

1. `intent = OBRT`
2. `taxRegime = Paušalni` (OBRT_PAUSAL)
3. User confirmed extracted/manual core fields (OIB, name, address)
4. User completed Situacija + Setup steps

### Single Transaction

```typescript
await db.$transaction(async (tx) => {
  // 1. Create Company with final legalForm
  const company = await tx.company.create({
    data: {
      name: confirmedData.name,
      oib: confirmedData.oib,
      legalForm: "OBRT_PAUSAL",
      address: confirmedData.address,
      // ... other fields
    },
  })

  // 2. Create CompanyUser (OWNER role)
  await tx.companyUser.create({
    data: {
      userId: user.id,
      companyId: company.id,
      role: "OWNER",
      isDefault: true,
    },
  })

  // 3. Set entitlements based on legalForm
  await tx.company.update({
    where: { id: company.id },
    data: {
      entitlements: getEntitlementsForLegalForm("OBRT_PAUSAL"),
    },
  })
})
```

### Idempotency

- Unique constraint: one CompanyUser per userId (for single-company users)
- If user refreshes final step, check if CompanyUser exists → redirect to /cc
- Transaction ensures atomicity — partial state impossible

---

## Redirect Rules (Deterministic)

### Canonical State Machine

```
┌─────────────────────────────────────────────────────────────────────┐
│  User hits any app route                                            │
│                                                                      │
│  1. Not authenticated?                                              │
│     → /auth                                                         │
│                                                                      │
│  2. Authenticated, no CompanyUser?                                  │
│     → /onboarding                                                   │
│                                                                      │
│  3. Authenticated, has CompanyUser?                                 │
│     → /cc (or requested route)                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### /onboarding Internal State

```
┌─────────────────────────────────────────────────────────────────────┐
│  /onboarding                                                        │
│                                                                      │
│  1. intent = null?                                                  │
│     → Show intent selector                                          │
│                                                                      │
│  2. intent = DRUSTVO?                                               │
│     → Show gating/waitlist                                          │
│                                                                      │
│  3. intent = OBRT?                                                  │
│     → Check onboarding progress (store or URL state)                │
│     → Route to appropriate step                                     │
│                                                                      │
│  4. CompanyUser exists? (edge case: user completed in another tab)  │
│     → Redirect to /cc                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### AC1: No Company Created Unless Fully Qualified

- [ ] Company record only created when:
  - intent = OBRT
  - taxRegime = Paušalni (OBRT_PAUSAL)
  - Core fields confirmed (OIB, name)
  - Setup steps completed
- [ ] Transaction creates Company + CompanyUser + entitlements atomically
- [ ] Partial completion leaves NO database artifacts

### AC2: Idempotency

- [ ] Refreshing final step does not create duplicate Company
- [ ] Unique constraint on CompanyUser (userId + companyId)
- [ ] If CompanyUser exists, redirect to /cc

### AC3: Backwards Compatibility

- [ ] Existing users with `registrationIntent = null` see intent selector
- [ ] Existing paušalni users (with Company) continue working unchanged
- [ ] No migration required for existing Company records

### AC4: Unsupported Gating

- [ ] Selecting "Obrt na dohodak" shows "Uskoro" + waitlist, NO Company created
- [ ] Selecting "Obrt u sustavu PDV-a" shows "Uskoro" + waitlist, NO Company created
- [ ] Selecting "Društvo" shows "Uskoro" + waitlist, NO Company created
- [ ] Waitlist captures: email, selected type, timestamp

### AC5: Document Upload Non-Blocking

- [ ] Manual fields always visible regardless of upload state
- [ ] OCR results prefill fields as suggestions, user confirms
- [ ] OCR failure shows error toast, user continues manually
- [ ] Store extraction metadata for audit (values, confidence, docRef)

### AC6: Deterministic Redirects

- [ ] Unauthenticated → /auth (always)
- [ ] Authenticated + no CompanyUser → /onboarding (always)
- [ ] Authenticated + has CompanyUser → /cc (always)
- [ ] No "full UI briefly" flashes during redirect

---

## Files to Modify

| File                                              | Change                                             |
| ------------------------------------------------- | -------------------------------------------------- |
| `prisma/schema.prisma`                            | Add `RegistrationIntent` enum, fields on User      |
| `src/components/auth/steps/RegisterStep.tsx`      | New options (Obrt/Društvo), mandatory, save intent |
| `src/app/(app)/onboarding/page.tsx`               | Branch on intent, document-first UI                |
| `src/components/onboarding/intent-selector.tsx`   | New component for null intent                      |
| `src/components/onboarding/drustvo-gating.tsx`    | New component for Društvo waitlist                 |
| `src/components/onboarding/obrt-step1-info.tsx`   | Document upload first, then fields                 |
| `src/components/onboarding/obrt-step2-regime.tsx` | Tax regime with gating                             |
| `src/app/actions/onboarding.ts`                   | Update to handle intent, final Company creation    |
| `src/lib/auth-utils.ts`                           | Simplify redirect logic per state machine          |
| `src/lib/waitlist.ts`                             | New: capture waitlist signups                      |

### Reuse Existing

- `DocumentUpload.tsx` component
- Paušalni Steps 2-3 (Situacija, Setup)
- `getEntitlementsForLegalForm()` function
- OCR extraction logic

---

## Out of Scope (Future)

- Obrt na dohodak support
- Obrt u sustavu PDV-a support
- j.d.o.o. support
- d.o.o. support
- Multi-company users
- Company transfer between users

---

## Implementation Order

1. **Schema migration** — Add registrationIntent to User
2. **Registration form** — Update options, save intent
3. **Onboarding refactor** — Intent selector, branching, document-first
4. **Gating screens** — Društvo + Dohodak/PDV waitlist
5. **Company creation** — Move to final step, single transaction
6. **Redirect cleanup** — Implement deterministic state machine
7. **Testing** — Cover all acceptance criteria
