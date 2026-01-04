# FiskAI Audit Phase 4 - Final Tasks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete final 4 audit items: multi-step onboarding wizard, contacts module enhancements, uptime monitoring, and analytics integration.

**Architecture:** Server-side React components with client-side wizard state, enhanced contacts with pagination/search, health metrics endpoint, and PostHog analytics for funnel tracking.

**Tech Stack:** Next.js 15, React 18, Tailwind CSS, Pino logging, PostHog analytics, zustand (wizard state)

---

## Task 1: Create Multi-Step Onboarding Wizard - State Management

**Files:**

- Create: `/home/admin/FiskAI/src/lib/stores/onboarding-store.ts`

**Step 1: Create zustand store for wizard state with localStorage persistence**

```typescript
// src/lib/stores/onboarding-store.ts
import { create } from "zustand"
import { persist } from "zustand/middleware"

export type OnboardingStep = 1 | 2 | 3

export interface OnboardingData {
  // Step 1: Basic Info
  name: string
  oib: string

  // Step 2: Address
  address: string
  postalCode: string
  city: string
  country: string

  // Step 3: Contact & Tax
  email: string
  phone: string
  iban: string
  isVatPayer: boolean
}

interface OnboardingState {
  currentStep: OnboardingStep
  data: Partial<OnboardingData>
  setStep: (step: OnboardingStep) => void
  updateData: (data: Partial<OnboardingData>) => void
  reset: () => void
  isStepValid: (step: OnboardingStep) => boolean
}

const initialData: Partial<OnboardingData> = {
  country: "HR",
  isVatPayer: false,
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      data: initialData,

      setStep: (step) => set({ currentStep: step }),

      updateData: (newData) =>
        set((state) => ({
          data: { ...state.data, ...newData },
        })),

      reset: () =>
        set({
          currentStep: 1,
          data: initialData,
        }),

      isStepValid: (step) => {
        const { data } = get()
        switch (step) {
          case 1:
            return !!(data.name?.trim() && data.oib?.match(/^\d{11}$/))
          case 2:
            return !!(
              data.address?.trim() &&
              data.postalCode?.trim() &&
              data.city?.trim() &&
              data.country?.trim()
            )
          case 3:
            return !!(data.email?.includes("@") && data.iban?.trim())
          default:
            return false
        }
      },
    }),
    {
      name: "fiskai-onboarding",
      partialize: (state) => ({
        currentStep: state.currentStep,
        data: state.data,
      }),
    }
  )
)
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes with no errors

---

## Task 2: Create Onboarding Step Components

**Files:**

- Create: `/home/admin/FiskAI/src/components/onboarding/step-indicator.tsx`
- Create: `/home/admin/FiskAI/src/components/onboarding/step-basic-info.tsx`
- Create: `/home/admin/FiskAI/src/components/onboarding/step-address.tsx`
- Create: `/home/admin/FiskAI/src/components/onboarding/step-contact-tax.tsx`

**Step 1: Create step indicator component**

```tsx
// src/components/onboarding/step-indicator.tsx
"use client"

import { cn } from "@/lib/utils"
import { OnboardingStep } from "@/lib/stores/onboarding-store"

const steps = [
  { number: 1, title: "Osnovni podaci" },
  { number: 2, title: "Adresa" },
  { number: 3, title: "Kontakt i porez" },
] as const

interface StepIndicatorProps {
  currentStep: OnboardingStep
  isStepValid: (step: OnboardingStep) => boolean
}

export function StepIndicator({ currentStep, isStepValid }: StepIndicatorProps) {
  return (
    <nav aria-label="Napredak" className="mb-8">
      <ol className="flex items-center justify-center gap-2">
        {steps.map((step, index) => {
          const isActive = step.number === currentStep
          const isCompleted =
            step.number < currentStep || isStepValid(step.number as OnboardingStep)
          const isPast = step.number < currentStep

          return (
            <li key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    isActive && "border-blue-600 bg-blue-600 text-white",
                    isPast && "border-green-600 bg-green-600 text-white",
                    !isActive && !isPast && "border-gray-300 bg-white text-gray-500"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isPast ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isActive ? "text-blue-600" : "text-gray-500"
                  )}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={cn("mx-4 h-0.5 w-12", isPast ? "bg-green-600" : "bg-gray-200")} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
```

**Step 2: Create Step 1 - Basic Info component**

```tsx
// src/components/onboarding/step-basic-info.tsx
"use client"

import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function StepBasicInfo() {
  const { data, updateData, setStep, isStepValid } = useOnboardingStore()

  const handleNext = () => {
    if (isStepValid(1)) {
      setStep(2)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Osnovni podaci tvrtke</h2>
        <p className="mt-1 text-sm text-gray-600">Unesite naziv i OIB vaše tvrtke</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Naziv tvrtke *
          </label>
          <Input
            id="name"
            value={data.name || ""}
            onChange={(e) => updateData({ name: e.target.value })}
            placeholder="Moja Tvrtka d.o.o."
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="oib" className="block text-sm font-medium text-gray-700">
            OIB *
          </label>
          <Input
            id="oib"
            value={data.oib || ""}
            onChange={(e) => updateData({ oib: e.target.value.replace(/\D/g, "").slice(0, 11) })}
            placeholder="12345678901"
            maxLength={11}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-gray-500">Osobni identifikacijski broj (11 znamenki)</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!isStepValid(1)}>
          Dalje
        </Button>
      </div>
    </div>
  )
}
```

**Step 3: Create Step 2 - Address component**

```tsx
// src/components/onboarding/step-address.tsx
"use client"

import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function StepAddress() {
  const { data, updateData, setStep, isStepValid } = useOnboardingStore()

  const handleNext = () => {
    if (isStepValid(2)) {
      setStep(3)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Adresa tvrtke</h2>
        <p className="mt-1 text-sm text-gray-600">Unesite poslovnu adresu</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Ulica i kućni broj *
          </label>
          <Input
            id="address"
            value={data.address || ""}
            onChange={(e) => updateData({ address: e.target.value })}
            placeholder="Ilica 1"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">
              Poštanski broj *
            </label>
            <Input
              id="postalCode"
              value={data.postalCode || ""}
              onChange={(e) => updateData({ postalCode: e.target.value })}
              placeholder="10000"
              className="mt-1"
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700">
              Grad *
            </label>
            <Input
              id="city"
              value={data.city || ""}
              onChange={(e) => updateData({ city: e.target.value })}
              placeholder="Zagreb"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700">
            Država *
          </label>
          <Input
            id="country"
            value={data.country || "HR"}
            onChange={(e) => updateData({ country: e.target.value })}
            placeholder="HR"
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(1)}>
          Natrag
        </Button>
        <Button onClick={handleNext} disabled={!isStepValid(2)}>
          Dalje
        </Button>
      </div>
    </div>
  )
}
```

**Step 4: Create Step 3 - Contact & Tax component**

```tsx
// src/components/onboarding/step-contact-tax.tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createCompany } from "@/app/actions/company"
import { toast } from "@/lib/toast"

export function StepContactTax() {
  const router = useRouter()
  const { data, updateData, setStep, reset, isStepValid } = useOnboardingStore()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!isStepValid(3)) return

    startTransition(async () => {
      setError(null)

      const result = await createCompany({
        name: data.name!,
        oib: data.oib!,
        address: data.address!,
        postalCode: data.postalCode!,
        city: data.city!,
        country: data.country!,
        email: data.email!,
        phone: data.phone || "",
        iban: data.iban!,
        isVatPayer: data.isVatPayer || false,
      })

      if (result?.error) {
        setError(result.error)
        toast.error("Greška", result.error)
      } else {
        reset() // Clear stored wizard data
        toast.success("Tvrtka kreirana!", "Možete početi s radom")
        router.push("/dashboard")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Kontakt i porezni podaci</h2>
        <p className="mt-1 text-sm text-gray-600">Završite postavljanje tvrtke</p>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email *
          </label>
          <Input
            id="email"
            type="email"
            value={data.email || ""}
            onChange={(e) => updateData({ email: e.target.value })}
            placeholder="info@tvrtka.hr"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Telefon
          </label>
          <Input
            id="phone"
            value={data.phone || ""}
            onChange={(e) => updateData({ phone: e.target.value })}
            placeholder="+385 1 234 5678"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="iban" className="block text-sm font-medium text-gray-700">
            IBAN *
          </label>
          <Input
            id="iban"
            value={data.iban || ""}
            onChange={(e) => updateData({ iban: e.target.value.toUpperCase() })}
            placeholder="HR1234567890123456789"
            className="mt-1"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="isVatPayer"
            type="checkbox"
            checked={data.isVatPayer || false}
            onChange={(e) => updateData({ isVatPayer: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isVatPayer" className="text-sm text-gray-700">
            Tvrtka je obveznik PDV-a
          </label>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(2)} disabled={isPending}>
          Natrag
        </Button>
        <Button onClick={handleSubmit} disabled={!isStepValid(3) || isPending}>
          {isPending ? "Spremanje..." : "Završi postavljanje"}
        </Button>
      </div>
    </div>
  )
}
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes

---

## Task 3: Update Onboarding Page to Use Wizard

**Files:**

- Modify: `/home/admin/FiskAI/src/app/(dashboard)/onboarding/page.tsx`

**Step 1: Replace single form with multi-step wizard**

```tsx
// src/app/(dashboard)/onboarding/page.tsx
"use client"

import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { StepBasicInfo } from "@/components/onboarding/step-basic-info"
import { StepAddress } from "@/components/onboarding/step-address"
import { StepContactTax } from "@/components/onboarding/step-contact-tax"
import { Card, CardContent } from "@/components/ui/card"

export default function OnboardingPage() {
  const { currentStep, isStepValid } = useOnboardingStore()

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Dobrodošli u FiskAI</h1>
        <p className="mt-2 text-gray-600">Postavite svoju tvrtku u 3 jednostavna koraka</p>
      </div>

      <StepIndicator currentStep={currentStep} isStepValid={isStepValid} />

      <Card>
        <CardContent className="pt-6">
          {currentStep === 1 && <StepBasicInfo />}
          {currentStep === 2 && <StepAddress />}
          {currentStep === 3 && <StepContactTax />}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-gray-500">
        Vaši podaci se automatski spremaju tijekom unosa
      </p>
    </div>
  )
}
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes

---

## Task 4: Add Contacts Pagination and Search

**Files:**

- Create: `/home/admin/FiskAI/src/app/actions/contact-list.ts`
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/contacts/page.tsx`

**Step 1: Create paginated contacts action**

```typescript
// src/app/actions/contact-list.ts
"use server"

import { db } from "@/lib/db"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { ContactType } from "@prisma/client"

export interface ContactListParams {
  search?: string
  type?: ContactType | "ALL"
  page?: number
  limit?: number
}

export async function getContactList(params: ContactListParams = {}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const { search, type, page = 1, limit = 20 } = params
  const skip = (page - 1) * limit

  const where = {
    companyId: company.id,
    ...(type && type !== "ALL" && { type }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { oib: { contains: search } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  }

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        type: true,
        oib: true,
        email: true,
        phone: true,
        city: true,
        _count: {
          select: {
            invoicesAsBuyer: true,
            invoicesAsSeller: true,
          },
        },
      },
    }),
    db.contact.count({ where }),
  ])

  return {
    contacts,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + contacts.length < total,
    },
  }
}
```

**Step 2: Update contacts page with search and pagination**

```tsx
// src/app/(dashboard)/contacts/page.tsx
import Link from "next/link"
import { getContactList, ContactListParams } from "@/app/actions/contact-list"
import { DeleteContactButton } from "./delete-button"
import { Button } from "@/components/ui/button"
import { ContactType } from "@prisma/client"

interface PageProps {
  searchParams: Promise<{ search?: string; type?: string; page?: string }>
}

export default async function ContactsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search || ""
  const type = (params.type as ContactType | "ALL") || "ALL"
  const page = parseInt(params.page || "1", 10)

  const { contacts, pagination } = await getContactList({
    search,
    type,
    page,
    limit: 20,
  })

  const typeLabels: Record<ContactType, string> = {
    CUSTOMER: "Kupac",
    SUPPLIER: "Dobavljač",
    BOTH: "Kupac/Dobavljač",
  }

  const typeColors: Record<ContactType, string> = {
    CUSTOMER: "bg-blue-100 text-blue-700",
    SUPPLIER: "bg-purple-100 text-purple-700",
    BOTH: "bg-green-100 text-green-700",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kontakti</h1>
          <p className="text-sm text-gray-600">{pagination.total} kontakata ukupno</p>
        </div>
        <Link href="/contacts/new">
          <Button>+ Novi kontakt</Button>
        </Link>
      </div>

      {/* Search and Filter */}
      <form className="flex gap-4" method="get">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Pretraži po nazivu, OIB-u ili emailu..."
          className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="type"
          defaultValue={type}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Svi tipovi</option>
          <option value="CUSTOMER">Kupci</option>
          <option value="SUPPLIER">Dobavljači</option>
          <option value="BOTH">Kupci/Dobavljači</option>
        </select>
        <Button type="submit" variant="outline">
          Filtriraj
        </Button>
      </form>

      {contacts.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">
            {search || type !== "ALL"
              ? "Nema kontakata koji odgovaraju filteru"
              : "Nemate još nijedan kontakt"}
          </p>
          {!search && type === "ALL" && (
            <Link href="/contacts/new" className="mt-2 inline-block text-blue-600 hover:underline">
              Dodajte prvi kontakt
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{contact.name}</h3>
                    <span
                      className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${
                        typeColors[contact.type]
                      }`}
                    >
                      {typeLabels[contact.type]}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {contact._count.invoicesAsBuyer + contact._count.invoicesAsSeller} računa
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <p>OIB: {contact.oib}</p>
                  {contact.email && <p>{contact.email}</p>}
                  {contact.phone && <p>{contact.phone}</p>}
                  {contact.city && <p>{contact.city}</p>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/contacts/${contact.id}/edit`}>
                    <Button variant="outline" size="sm">
                      Uredi
                    </Button>
                  </Link>
                  <DeleteContactButton contactId={contact.id} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/contacts?page=${page - 1}${search ? `&search=${search}` : ""}${type !== "ALL" ? `&type=${type}` : ""}`}
                >
                  <Button variant="outline" size="sm">
                    Prethodna
                  </Button>
                </Link>
              )}
              <span className="text-sm text-gray-600">
                Stranica {page} od {pagination.totalPages}
              </span>
              {pagination.hasMore && (
                <Link
                  href={`/contacts?page=${page + 1}${search ? `&search=${search}` : ""}${type !== "ALL" ? `&type=${type}` : ""}`}
                >
                  <Button variant="outline" size="sm">
                    Sljedeća
                  </Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes

---

## Task 5: Add Prometheus-Compatible Metrics Endpoint

**Files:**

- Create: `/home/admin/FiskAI/src/app/api/metrics/route.ts`
- Modify: `/home/admin/FiskAI/src/app/api/health/ready/route.ts`

**Step 1: Create metrics endpoint**

```typescript
// src/app/api/metrics/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const startTime = Date.now()

  try {
    // Collect metrics
    const [userCount, companyCount, contactCount, invoiceCount, invoicesByStatus] =
      await Promise.all([
        db.user.count(),
        db.company.count(),
        db.contact.count(),
        db.eInvoice.count(),
        db.eInvoice.groupBy({
          by: ["status"],
          _count: { id: true },
        }),
      ])

    const dbQueryTime = Date.now() - startTime

    // Format as Prometheus text exposition format
    const metrics = [
      "# HELP fiskai_users_total Total number of registered users",
      "# TYPE fiskai_users_total gauge",
      `fiskai_users_total ${userCount}`,
      "",
      "# HELP fiskai_companies_total Total number of companies",
      "# TYPE fiskai_companies_total gauge",
      `fiskai_companies_total ${companyCount}`,
      "",
      "# HELP fiskai_contacts_total Total number of contacts",
      "# TYPE fiskai_contacts_total gauge",
      `fiskai_contacts_total ${contactCount}`,
      "",
      "# HELP fiskai_invoices_total Total number of invoices",
      "# TYPE fiskai_invoices_total gauge",
      `fiskai_invoices_total ${invoiceCount}`,
      "",
      "# HELP fiskai_invoices_by_status Number of invoices by status",
      "# TYPE fiskai_invoices_by_status gauge",
      ...invoicesByStatus.map(
        (s) => `fiskai_invoices_by_status{status="${s.status}"} ${s._count.id}`
      ),
      "",
      "# HELP fiskai_db_query_duration_ms Database query duration in milliseconds",
      "# TYPE fiskai_db_query_duration_ms gauge",
      `fiskai_db_query_duration_ms ${dbQueryTime}`,
      "",
      "# HELP fiskai_up Application up status (1 = up)",
      "# TYPE fiskai_up gauge",
      "fiskai_up 1",
    ].join("\n")

    return new NextResponse(metrics, {
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      },
    })
  } catch (error) {
    const metrics = [
      "# HELP fiskai_up Application up status (1 = up, 0 = down)",
      "# TYPE fiskai_up gauge",
      "fiskai_up 0",
    ].join("\n")

    return new NextResponse(metrics, {
      status: 503,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      },
    })
  }
}
```

**Step 2: Enhance readiness endpoint with more checks**

```typescript
// src/app/api/health/ready/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface HealthCheck {
  status: "ok" | "degraded" | "failed"
  latency?: number
  message?: string
}

export async function GET() {
  const checks: Record<string, HealthCheck> = {}
  let overallStatus: "ready" | "degraded" | "not_ready" = "ready"

  // Database check
  const dbStart = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = {
      status: "ok",
      latency: Date.now() - dbStart,
    }
  } catch (error) {
    checks.database = {
      status: "failed",
      latency: Date.now() - dbStart,
      message: error instanceof Error ? error.message : "Unknown error",
    }
    overallStatus = "not_ready"
  }

  // Memory check
  const memUsage = process.memoryUsage()
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
  const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)

  checks.memory = {
    status: heapPercent > 90 ? "degraded" : "ok",
    message: `${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)`,
  }

  if (heapPercent > 90 && overallStatus === "ready") {
    overallStatus = "degraded"
  }

  // Uptime
  const uptimeSeconds = Math.round(process.uptime())

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    uptime: uptimeSeconds,
    checks,
  }

  const statusCode = overallStatus === "not_ready" ? 503 : 200

  return NextResponse.json(response, { status: statusCode })
}
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes

---

## Task 6: Add PostHog Analytics Integration

**Files:**

- Run: `npm install posthog-js`
- Create: `/home/admin/FiskAI/src/lib/analytics.ts`
- Create: `/home/admin/FiskAI/src/components/providers/analytics-provider.tsx`
- Modify: `/home/admin/FiskAI/src/app/layout.tsx`

**Step 1: Install PostHog**

```bash
npm install posthog-js
```

**Step 2: Create analytics helper**

```typescript
// src/lib/analytics.ts
import posthog from "posthog-js"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com"

export function initAnalytics() {
  if (typeof window === "undefined") return
  if (!POSTHOG_KEY) return

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false, // We capture manually for SPA
    capture_pageleave: true,
    autocapture: false, // Disable autocapture for GDPR
  })
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return
  posthog.identify(userId, properties)
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return
  posthog.capture(event, properties)
}

export function trackPageView(path: string) {
  if (!POSTHOG_KEY) return
  posthog.capture("$pageview", { $current_url: path })
}

// Predefined events for consistency
export const AnalyticsEvents = {
  // Onboarding funnel
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
  ONBOARDING_COMPLETED: "onboarding_completed",

  // Invoice funnel
  INVOICE_CREATED: "invoice_created",
  INVOICE_SENT: "invoice_sent",
  INVOICE_FISCALIZED: "invoice_fiscalized",

  // Contact events
  CONTACT_CREATED: "contact_created",
  CONTACT_UPDATED: "contact_updated",

  // Product events
  PRODUCT_CREATED: "product_created",

  // Settings
  SETTINGS_UPDATED: "settings_updated",
  EINVOICE_PROVIDER_CONFIGURED: "einvoice_provider_configured",
} as const
```

**Step 3: Create analytics provider component**

```tsx
// src/components/providers/analytics-provider.tsx
"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { initAnalytics, trackPageView } from "@/lib/analytics"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    if (pathname) {
      const url = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname
      trackPageView(url)
    }
  }, [pathname, searchParams])

  return <>{children}</>
}
```

**Step 4: Update layout to include analytics provider**

Add to `src/app/layout.tsx`:

```tsx
// At top, add import:
import { AnalyticsProvider } from "@/components/providers/analytics-provider"
import { Suspense } from "react"

// Wrap children in providers:
;<body className={inter.className}>
  <Toaster
    position="top-right"
    richColors
    closeButton
    toastOptions={{
      className: "font-sans",
      duration: 4000,
    }}
  />
  <Suspense fallback={null}>
    <AnalyticsProvider>{children}</AnalyticsProvider>
  </Suspense>
</body>
```

**Step 5: Add environment variables to .env.example**

```bash
# Analytics (PostHog)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes

---

## Task 7: Add Analytics Tracking to Key User Flows

**Files:**

- Modify: `/home/admin/FiskAI/src/components/onboarding/step-basic-info.tsx`
- Modify: `/home/admin/FiskAI/src/components/onboarding/step-contact-tax.tsx`
- Modify: `/home/admin/FiskAI/src/app/(dashboard)/e-invoices/new/invoice-form.tsx`

**Step 1: Track onboarding funnel**

In `step-basic-info.tsx`, add tracking when component mounts:

```tsx
// Add import at top:
import { useEffect } from "react"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"

// Add inside component, before return:
useEffect(() => {
  trackEvent(AnalyticsEvents.ONBOARDING_STARTED)
}, [])

// In handleNext, add tracking:
const handleNext = () => {
  if (isStepValid(1)) {
    trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step: 1 })
    setStep(2)
  }
}
```

In `step-contact-tax.tsx`, track completion:

```tsx
// Add import:
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"

// In handleSubmit, before router.push:
trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED)
```

**Step 2: Track invoice creation**

In `invoice-form.tsx`, add:

```tsx
// Add import:
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"

// In onSubmit, after successful creation (before router.push):
trackEvent(AnalyticsEvents.INVOICE_CREATED, {
  lineCount: data.lines.length,
  hasProduct: data.lines.some((l) => l.description),
})
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes

---

## Task 8: Commit All Changes

**Step 1: Stage all changes**

```bash
git add -A
```

**Step 2: Commit with descriptive message**

```bash
git commit -m "feat: implement audit phase 4 - onboarding wizard, contacts enhancement, monitoring

- Add multi-step onboarding wizard with autosave (zustand + localStorage)
- Create step indicator, basic info, address, and contact/tax step components
- Add contacts pagination with search and type filtering
- Show invoice count per contact for relationship tracking
- Add Prometheus-compatible /api/metrics endpoint
- Enhance /api/health/ready with memory check and detailed status
- Add PostHog analytics integration with privacy-focused config
- Track onboarding funnel and invoice creation events
- Add environment variables for PostHog configuration

Completes all remaining audit findings from phases 6-7:
- Multi-step onboarding wizard (Phase 6)
- Contacts module enhancements (Phase 6)
- Monitoring/metrics endpoint (Phase 7)
- Analytics integration (Phase 7)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**Verification:**

- Run: `git log --oneline -1`
- Expected: Shows new commit with message

---

## Verification Checklist

After all tasks complete:

1. `npm run build` - Must pass with no errors
2. `npm run lint` - Should pass (warnings OK)
3. Test onboarding:
   - Visit `/onboarding`, complete 3 steps
   - Refresh page mid-wizard - data should persist
   - Complete wizard - redirects to dashboard
4. Test contacts:
   - Visit `/contacts`, use search and filter
   - Pagination works with > 20 contacts
5. Test metrics:
   - `curl http://localhost:3002/api/metrics` returns Prometheus format
   - `curl http://localhost:3002/api/health/ready` returns detailed status
6. Test analytics (if PostHog key configured):
   - Page views tracked
   - Onboarding events captured

---

## Environment Variables Reference

Add to `.env` or `.env.local`:

```bash
# Analytics (optional - analytics disabled if not set)
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```
