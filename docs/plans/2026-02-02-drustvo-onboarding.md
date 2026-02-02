# DRUSTVO Onboarding Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the DRUSTVO waitlist/gating screen with a functional 2-step onboarding flow for D.O.O. and J.D.O.O. companies, enabling users with `registrationIntent=DRUSTVO` to complete onboarding.

**Architecture:** Mirror the existing OBRT pattern: Step 1 collects company info (OIB, name, legal form, address), Step 2 collects contact/tax info (email, phone, IBAN, VAT). After completion, redirect to Control Center. Reuse existing `createMinimalCompany` and `saveOnboardingData` server actions.

**Tech Stack:** Next.js 15 App Router, React Server Components, TypeScript, Tailwind CSS, Zod validation

---

## Context & Problem Analysis

### Current State

Users who selected `DRUSTVO` intent during registration are stuck at a waitlist gating screen (`drustvo-gating.tsx`). The `/onboarding/page.tsx` state machine routes them to `drustvo-gating` which shows "Podrška za društva dolazi uskoro".

### Target State

DRUSTVO users complete a 2-step onboarding flow similar to OBRT:

1. **Step 1 (drustvo-step1-info):** OIB, company name, legal form (DOO vs JDOO), address
2. **Step 2 (drustvo-step2-contact):** Email, phone, IBAN, VAT confirmation (always `true` for D.O.O.)
3. **Redirect to /cc** - Start using the app

### Key Differences from OBRT

| Aspect          | OBRT                             | DRUSTVO                              |
| --------------- | -------------------------------- | ------------------------------------ |
| Legal forms     | OBRT_PAUSAL, OBRT_REAL, OBRT_VAT | DOO, JDOO                            |
| VAT status      | Optional (based on regime)       | Always `true` (mandatory for D.O.O.) |
| Tax regime step | Yes (pausalni/dohodak/pdv)       | No (single regime)                   |
| Document upload | Yes (rješenje o obrtu)           | Optional (not required for MVP)      |

---

## Task 1: Create DrushtvoStep1Info Component

**Files:**

- Create: `src/components/onboarding/drustvo-step1-info.tsx`

**Step 1: Create the component file**

```typescript
// src/components/onboarding/drustvo-step1-info.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Building2 } from "lucide-react"
import { createMinimalCompany } from "@/lib/actions/onboarding"
import { oibSchema } from "@/lib/validations/oib"

interface DrushtvoStep1InfoProps {
  onBack?: () => void
}

type LegalFormDrustvo = "DOO" | "JDOO"

export function DrushtvoStep1Info({ onBack }: DrushtvoStep1InfoProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [oib, setOib] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [legalForm, setLegalForm] = useState<LegalFormDrustvo>("DOO")
  const [address, setAddress] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [city, setCity] = useState("")

  // Validation errors
  const [oibError, setOibError] = useState<string | null>(null)

  const validateOib = (value: string) => {
    const result = oibSchema.safeParse(value)
    if (!result.success) {
      setOibError(result.error.errors[0]?.message || "Neispravan OIB")
      return false
    }
    setOibError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate OIB
    if (!validateOib(oib)) return

    // Validate required fields
    if (!companyName.trim()) {
      setError("Naziv tvrtke je obavezan")
      return
    }

    setIsSubmitting(true)

    try {
      const result = await createMinimalCompany({
        name: companyName.trim(),
        oib,
        legalForm,
      })

      if (result.error) {
        setError(result.error)
        setIsSubmitting(false)
        return
      }

      // Navigate to step 2
      router.push("/onboarding?step=drustvo-step2")
    } catch (err) {
      console.error("Failed to create company:", err)
      setError("Došlo je do greške. Molimo pokušajte ponovno.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900">
            <Building2 className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          </div>
          <CardTitle>Podaci o društvu</CardTitle>
          <CardDescription>
            Unesite osnovne podatke o vašem d.o.o. ili j.d.o.o.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OIB */}
            <div className="space-y-2">
              <Label htmlFor="oib">OIB tvrtke *</Label>
              <Input
                id="oib"
                value={oib}
                onChange={(e) => {
                  setOib(e.target.value.replace(/\D/g, "").slice(0, 11))
                  if (oibError) validateOib(e.target.value)
                }}
                onBlur={() => oib && validateOib(oib)}
                placeholder="12345678901"
                maxLength={11}
                className={oibError ? "border-red-500" : ""}
              />
              {oibError && <p className="text-sm text-red-500">{oibError}</p>}
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName">Naziv tvrtke *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Moja Tvrtka d.o.o."
              />
            </div>

            {/* Legal Form */}
            <div className="space-y-3">
              <Label>Pravni oblik *</Label>
              <RadioGroup
                value={legalForm}
                onValueChange={(v) => setLegalForm(v as LegalFormDrustvo)}
                className="space-y-3"
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="DOO" id="doo" className="mt-1" />
                  <div>
                    <p className="font-medium">D.O.O.</p>
                    <p className="text-sm text-muted-foreground">
                      Društvo s ograničenom odgovornošću
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="JDOO" id="jdoo" className="mt-1" />
                  <div>
                    <p className="font-medium">J.D.O.O.</p>
                    <p className="text-sm text-muted-foreground">
                      Jednostavno društvo s ograničenom odgovornošću
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Address (optional for step 1) */}
            <div className="space-y-2">
              <Label htmlFor="address">Adresa sjedišta</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ulica i kućni broj"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Poštanski broj</Label>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="10000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Grad</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Zagreb"
                />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {onBack && (
                <Button type="button" variant="outline" onClick={onBack} className="flex-1">
                  Natrag
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Spremanje...
                  </>
                ) : (
                  "Nastavi"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/onboarding/drustvo-step1-info.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): add DrushtvoStep1Info component

First step of DRUSTVO onboarding flow. Collects:
- OIB (with validation)
- Company name
- Legal form (DOO vs JDOO)
- Address (optional)

Uses existing createMinimalCompany server action.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create DrushtvoStep2Contact Component

**Files:**

- Create: `src/components/onboarding/drustvo-step2-contact.tsx`

**Step 1: Create the component file**

```typescript
// src/components/onboarding/drustvo-step2-contact.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Mail, CheckCircle2 } from "lucide-react"
import { saveOnboardingData, getOnboardingData } from "@/lib/actions/onboarding"

interface DrushtvoStep2ContactProps {
  onBack?: () => void
}

export function DrushtvoStep2Contact({ onBack }: DrushtvoStep2ContactProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pre-loaded data from step 1
  const [existingData, setExistingData] = useState<{
    name: string
    oib: string
    legalForm: string
    address?: string
    postalCode?: string
    city?: string
  } | null>(null)

  // Form state
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [iban, setIban] = useState("")

  // Validation
  const [emailError, setEmailError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getOnboardingData()
        if (data && data.name && data.oib && data.legalForm) {
          setExistingData({
            name: data.name,
            oib: data.oib,
            legalForm: data.legalForm,
            address: data.address ?? undefined,
            postalCode: data.postalCode ?? undefined,
            city: data.city ?? undefined,
          })
          // Pre-fill email if exists
          if (data.email) setEmail(data.email)
          if (data.phone) setPhone(data.phone)
          if (data.iban) setIban(data.iban)
        } else {
          // No company data, go back to step 1
          router.push("/onboarding?step=drustvo-step1")
        }
      } catch (err) {
        console.error("Failed to load onboarding data:", err)
        setError("Došlo je do greške pri učitavanju podataka.")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [router])

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      setEmailError("Unesite ispravnu email adresu")
      return false
    }
    setEmailError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!existingData) {
      setError("Nema podataka o tvrtki. Vratite se na prvi korak.")
      return
    }

    // Validate email
    if (!validateEmail(email)) return

    setIsSubmitting(true)

    try {
      const result = await saveOnboardingData({
        name: existingData.name,
        oib: existingData.oib,
        legalForm: existingData.legalForm as "DOO" | "JDOO" | "OBRT_PAUSAL" | "OBRT_REAL" | "OBRT_VAT",
        address: existingData.address,
        postalCode: existingData.postalCode,
        city: existingData.city,
        country: "HR",
        email,
        phone: phone || undefined,
        iban: iban || undefined,
        isVatPayer: true, // D.O.O. is always VAT payer
      })

      if (result.error) {
        setError(result.error)
        setIsSubmitting(false)
        return
      }

      // Success - redirect to Control Center
      router.push("/cc")
    } catch (err) {
      console.error("Failed to save onboarding data:", err)
      setError("Došlo je do greške. Molimo pokušajte ponovno.")
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900">
            <Mail className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          </div>
          <CardTitle>Kontakt podaci</CardTitle>
          <CardDescription>
            Unesite kontakt podatke i IBAN za vaše poslovanje
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Company Summary */}
          {existingData && (
            <div className="mb-6 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Tvrtka kreirana</span>
              </div>
              <p className="font-medium">{existingData.name}</p>
              <p className="text-sm text-muted-foreground">
                OIB: {existingData.oib} • {existingData.legalForm === "DOO" ? "D.O.O." : "J.D.O.O."}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email adresa *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) validateEmail(e.target.value)
                }}
                onBlur={() => email && validateEmail(email)}
                placeholder="info@tvrtka.hr"
                className={emailError ? "border-red-500" : ""}
              />
              {emailError && <p className="text-sm text-red-500">{emailError}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+385 1 234 5678"
              />
            </div>

            {/* IBAN */}
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN poslovnog računa</Label>
              <Input
                id="iban"
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase().replace(/\s/g, ""))}
                placeholder="HR1234567890123456789"
              />
              <p className="text-xs text-muted-foreground">
                Možete dodati kasnije u postavkama
              </p>
            </div>

            {/* VAT Info */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>PDV obveznik:</strong> Društva s ograničenom odgovornošću su obveznici PDV-a.
                Vaš PDV broj će biti automatski kreiran (HR + OIB).
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {onBack && (
                <Button type="button" variant="outline" onClick={onBack} className="flex-1">
                  Natrag
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Spremanje...
                  </>
                ) : (
                  "Završi registraciju"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/onboarding/drustvo-step2-contact.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): add DrushtvoStep2Contact component

Second step of DRUSTVO onboarding flow. Collects:
- Email (required)
- Phone (optional)
- IBAN (optional)

D.O.O. is always VAT payer, so isVatPayer is hardcoded to true.
Redirects to /cc on completion.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update Onboarding Page State Machine

**Files:**

- Modify: `src/app/(app)/onboarding/page.tsx`

**Step 1: Read current onboarding page**

Read the file to understand the current state machine structure.

**Step 2: Add DRUSTVO flow states**

Update the state machine to handle:

- `drustvo-step1` - Show DrushtvoStep1Info
- `drustvo-step2` - Show DrushtvoStep2Contact

Replace the `drustvo-gating` case with actual onboarding steps.

**Step 3: Import new components**

```typescript
import { DrushtvoStep1Info } from "@/components/onboarding/drustvo-step1-info"
import { DrushtvoStep2Contact } from "@/components/onboarding/drustvo-step2-contact"
```

**Step 4: Update switch statement**

Change from:

```typescript
case "DRUSTVO":
  return <DrushtvoGating />
```

To:

```typescript
case "DRUSTVO":
  // Check if company exists (step 1 completed)
  if (currentCompany) {
    return <DrushtvoStep2Contact onBack={() => router.push("/onboarding?step=drustvo-step1")} />
  }
  return <DrushtvoStep1Info onBack={() => router.push("/onboarding?intent=select")} />
```

Also handle explicit step URL params:

```typescript
// Handle explicit step navigation
const step = searchParams.step
if (step === "drustvo-step1") {
  return <DrushtvoStep1Info onBack={() => router.push("/onboarding?intent=select")} />
}
if (step === "drustvo-step2") {
  return <DrushtvoStep2Contact onBack={() => router.push("/onboarding?step=drustvo-step1")} />
}
```

**Step 5: Commit**

```bash
git add src/app/(app)/onboarding/page.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): integrate DRUSTVO flow into state machine

Replace waitlist gating with actual onboarding steps:
- drustvo-step1: Company info (OIB, name, legal form)
- drustvo-step2: Contact info (email, phone, IBAN)

Users with registrationIntent=DRUSTVO can now complete onboarding.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Export New Components from Index

**Files:**

- Modify: `src/components/onboarding/index.ts` (if exists, or create)

**Step 1: Check if index file exists**

If not, create it. If yes, add exports.

**Step 2: Add exports**

```typescript
export { DrushtvoStep1Info } from "./drustvo-step1-info"
export { DrushtvoStep2Contact } from "./drustvo-step2-contact"
```

**Step 3: Commit**

```bash
git add src/components/onboarding/index.ts
git commit -m "$(cat <<'EOF'
chore(onboarding): export DRUSTVO components from index

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Remove Old 6-Step Wizard (Optional Cleanup)

**Files:**

- Consider removing (after confirming no other usage):
  - `src/components/onboarding/step-basic-info.tsx`
  - `src/components/onboarding/step-competence.tsx`
  - `src/components/onboarding/step-address.tsx`
  - `src/components/onboarding/step-contact-tax.tsx`
  - `src/components/onboarding/step-pausalni-profile.tsx`
  - `src/components/onboarding/step-billing.tsx`
  - `src/lib/stores/onboarding-store.ts`

**Step 1: Search for usages**

```bash
grep -r "step-basic-info\|step-competence\|step-address\|step-contact-tax\|step-pausalni-profile\|step-billing\|onboarding-store" src/ --include="*.tsx" --include="*.ts"
```

**Step 2: If no usages found, delete files**

Only delete if nothing imports them.

**Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(onboarding): remove unused 6-step wizard components

These components were from the old wizard-based onboarding flow
that was never connected to the current intent-based system.

Removed:
- step-basic-info.tsx
- step-competence.tsx
- step-address.tsx
- step-contact-tax.tsx
- step-pausalni-profile.tsx
- step-billing.tsx
- onboarding-store.ts

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update DrushtvoGating Component (Deprecate)

**Files:**

- Modify: `src/components/onboarding/drustvo-gating.tsx`

**Step 1: Add deprecation notice**

Update the component to redirect to the new flow instead of showing waitlist.

```typescript
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * @deprecated DRUSTVO onboarding is now active. This component redirects to the new flow.
 */
export function DrushtvoGating() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to actual DRUSTVO onboarding
    router.push("/onboarding?step=drustvo-step1")
  }, [router])

  return null
}
```

**Step 2: Commit**

```bash
git add src/components/onboarding/drustvo-gating.tsx
git commit -m "$(cat <<'EOF'
refactor(onboarding): deprecate DrushtvoGating waitlist

DRUSTVO onboarding is now active. The gating component now
redirects to the actual onboarding flow instead of showing
a waitlist message.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Test the Flow Manually

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test as user with DRUSTVO intent**

1. Log in as `info@metrica.hr` (user with registrationIntent=DRUSTVO)
2. Verify redirect to `/onboarding?step=drustvo-step1`
3. Fill in company info and submit
4. Verify redirect to `/onboarding?step=drustvo-step2`
5. Fill in contact info and submit
6. Verify redirect to `/cc`
7. Verify company appears correctly in sidebar/nav

**Step 3: Test navigation**

- Back button on step 2 returns to step 1
- Back button on step 1 returns to intent selection (if applicable)

---

## Task 8: Run Linting and Type Checks

**Step 1: Run TypeScript check**

```bash
npm run typecheck
```

**Step 2: Run ESLint**

```bash
npm run lint
```

**Step 3: Fix any issues**

Address any type errors or lint violations.

**Step 4: Commit fixes if needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(onboarding): address lint and type issues

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Create PR

**Step 1: Create feature branch (if not already on one)**

```bash
git checkout -b feat/drustvo-onboarding
```

**Step 2: Push and create PR**

```bash
git push -u origin feat/drustvo-onboarding
gh pr create --title "feat: add DRUSTVO onboarding flow" --body "$(cat <<'EOF'
## Summary

Replaces the DRUSTVO waitlist/gating screen with a functional 2-step onboarding flow for D.O.O. and J.D.O.O. companies.

### Changes

- Add `DrushtvoStep1Info` component (OIB, name, legal form, address)
- Add `DrushtvoStep2Contact` component (email, phone, IBAN)
- Update onboarding state machine to handle DRUSTVO flow
- Deprecate `DrushtvoGating` waitlist component
- Remove unused 6-step wizard components (if confirmed unused)

### Key Differences from OBRT Flow

| Aspect | OBRT | DRUSTVO |
|--------|------|---------|
| Legal forms | OBRT_PAUSAL, OBRT_REAL, OBRT_VAT | DOO, JDOO |
| VAT status | Optional | Always true |
| Tax regime step | Yes | No |
| Steps | 2 steps | 2 steps |

## Test Plan

- [ ] Login as user with `registrationIntent=DRUSTVO`
- [ ] Complete step 1 (company info)
- [ ] Complete step 2 (contact info)
- [ ] Verify redirect to /cc
- [ ] Verify company data saved correctly
- [ ] Test back navigation
- [ ] Verify lint/typecheck passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Success Criteria

- [ ] Users with `registrationIntent=DRUSTVO` complete onboarding
- [ ] Company created with correct legal form (DOO or JDOO)
- [ ] VAT status set to `true` for all D.O.O. companies
- [ ] Redirect to `/cc` after completion
- [ ] No more waitlist/gating screen for DRUSTVO users
- [ ] CI passes (lint, typecheck, tests)
