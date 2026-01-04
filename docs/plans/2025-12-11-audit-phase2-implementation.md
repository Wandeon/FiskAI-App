# FiskAI Audit Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement remaining audit findings: infrastructure hardening, multi-tenancy middleware, security polish, UX enhancements, and observability.

**Architecture:** Server-side React components with Next.js 15, Prisma 7 with PostgreSQL, structured logging with Pino, and Docker deployment on ARM64.

**Tech Stack:** Next.js 15, Prisma 7, Pino, TypeScript, Tailwind CSS, Docker

---

## Task 1: Split Docker Compose Files (dev/prod)

**Files:**

- Create: `docker-compose.dev.yml`
- Create: `docker-compose.prod.yml`
- Modify: `docker-compose.yml` (base configuration)

**Step 1: Create base docker-compose.yml**

```yaml
# docker-compose.yml - Base configuration (shared)
services:
  fiskai-db:
    image: postgres:16-alpine
    container_name: fiskai-postgres
    restart: unless-stopped
    volumes:
      - fiskai_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-fiskai} -d ${POSTGRES_DB:-fiskai}"]
      interval: 10s
      timeout: 5s
      retries: 5

  fiskai-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: fiskai-app
    restart: unless-stopped
    depends_on:
      fiskai-db:
        condition: service_healthy
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 || r.statusCode === 307 ? 0 : 1)).on('error', () => process.exit(1))",
        ]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  fiskai_postgres_data:
```

**Step 2: Create docker-compose.dev.yml**

```yaml
# docker-compose.dev.yml - Development overrides
services:
  fiskai-db:
    environment:
      POSTGRES_USER: fiskai
      POSTGRES_PASSWORD: fiskai_dev_password
      POSTGRES_DB: fiskai
    ports:
      - "5434:5432"
    networks:
      - fiskai_dev

  fiskai-app:
    environment:
      - DATABASE_URL=postgresql://fiskai:fiskai_dev_password@fiskai-db:5432/fiskai?schema=public
      - NEXTAUTH_URL=http://localhost:3002
      - NEXTAUTH_SECRET=dev_secret_change_in_production
      - NEXT_PUBLIC_APP_NAME=FiskAI Dev
      - NEXT_PUBLIC_APP_URL=http://localhost:3002
      - EINVOICE_KEY_SECRET=dev_einvoice_secret_32_chars_min
      - AUTH_TRUST_HOST=true
    ports:
      - "3002:3000"
    networks:
      - fiskai_dev
    volumes:
      - .:/app:ro
      - /app/node_modules
      - /app/.next

networks:
  fiskai_dev:
    driver: bridge
```

**Step 3: Create docker-compose.prod.yml**

```yaml
# docker-compose.prod.yml - Production overrides
services:
  fiskai-db:
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER required}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}
      POSTGRES_DB: ${POSTGRES_DB:-fiskai}
    networks:
      - fiskai_internal

  fiskai-app:
    environment:
      - DATABASE_URL=${DATABASE_URL:?DATABASE_URL required}
      - NEXTAUTH_URL=${NEXTAUTH_URL:?NEXTAUTH_URL required}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:?NEXTAUTH_SECRET required}
      - NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME:-FiskAI}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:?NEXT_PUBLIC_APP_URL required}
      - EINVOICE_KEY_SECRET=${EINVOICE_KEY_SECRET:?EINVOICE_KEY_SECRET required}
    networks:
      - fiskai_internal
      - coolify
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.fiskai.rule=Host(`erp.metrica.hr`)"
      - "traefik.http.routers.fiskai.entrypoints=https"
      - "traefik.http.routers.fiskai.tls=true"
      - "traefik.http.routers.fiskai.tls.certresolver=letsencrypt"
      - "traefik.http.services.fiskai.loadbalancer.server.port=3000"
    ports:
      - "3002:3000"

networks:
  fiskai_internal:
    driver: bridge
  coolify:
    external: true
```

**Verification:**

- Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- Expected: Valid merged configuration without errors

---

## Task 2: Fix Dockerfile ARM64 Platform

**Files:**

- Modify: `Dockerfile`

**Step 1: Update Dockerfile with ARM64 platform pin**

```dockerfile
# Dockerfile
FROM --platform=linux/arm64 node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Provide dummy DATABASE_URL for Prisma generate
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Generate Prisma client
RUN npx prisma generate

# Disable telemetry during the build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Verification:**

- Check: `grep "platform=linux/arm64" Dockerfile`
- Expected: Line shows `FROM --platform=linux/arm64`

---

## Task 3: Add npm Scripts for Prisma

**Files:**

- Modify: `package.json`

**Step 1: Add Prisma scripts to package.json**

Add these scripts to the "scripts" section:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate deploy",
    "db:migrate:dev": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "prisma db seed",
    "postinstall": "prisma generate"
  }
}
```

**Verification:**

- Run: `npm run db:generate`
- Expected: Prisma client generated successfully

---

## Task 4: Add Prisma Middleware for Tenant Filtering

**Files:**

- Create: `src/lib/prisma-extensions.ts`
- Modify: `src/lib/db.ts`

**Step 1: Create Prisma extension for tenant context**

```typescript
// src/lib/prisma-extensions.ts
import { Prisma, PrismaClient } from "@prisma/client"

// Context for current request
export type TenantContext = {
  companyId: string
  userId: string
}

// Global variable to hold current tenant context (set per-request)
let currentTenantContext: TenantContext | null = null

export function setTenantContext(context: TenantContext | null) {
  currentTenantContext = context
}

export function getTenantContext(): TenantContext | null {
  return currentTenantContext
}

// Models that require tenant filtering
const TENANT_MODELS = ["Contact", "Product", "EInvoice", "EInvoiceLine"] as const

// Extension to automatically add companyId filter to queries
export function withTenantIsolation(prisma: PrismaClient) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async findFirst({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async findUnique({ model, args, query }) {
          // For findUnique, we verify after fetch instead of modifying where
          const result = await query(args)
          const context = getTenantContext()
          if (
            context &&
            result &&
            TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])
          ) {
            if ((result as { companyId?: string }).companyId !== context.companyId) {
              return null // Hide records from other tenants
            }
          }
          return result
        },
        async create({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.data = {
              ...args.data,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async update({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
        async delete({ model, args, query }) {
          const context = getTenantContext()
          if (context && TENANT_MODELS.includes(model as (typeof TENANT_MODELS)[number])) {
            args.where = {
              ...args.where,
              companyId: context.companyId,
            }
          }
          return query(args)
        },
      },
    },
  })
}
```

**Step 2: Update db.ts to use extension**

```typescript
// src/lib/db.ts
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { withTenantIsolation } from "./prisma-extensions"

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof withTenantIsolation> | undefined
  pool: Pool | undefined
}

const pool = globalForPrisma.pool ?? new Pool({ connectionString: process.env.DATABASE_URL })
const basePrisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const db = globalForPrisma.prisma ?? withTenantIsolation(basePrisma)

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
  globalForPrisma.pool = pool
}

export { db }
export { setTenantContext, getTenantContext } from "./prisma-extensions"
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes with no type errors

---

## Task 5: Add Structured ActionResult Type

**Files:**

- Create: `src/lib/action-result.ts`
- Modify: `src/app/actions/e-invoice.ts` (example usage)

**Step 1: Create ActionResult type**

```typescript
// src/lib/action-result.ts

// Standardized action result type
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; field?: string }

// Helper functions for creating results
export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function err(error: string, code?: string, field?: string): ActionResult<never> {
  return { success: false, error, code, field }
}

// Common error codes
export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  TENANT_VIOLATION: "TENANT_VIOLATION",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

// Type guard to check if result is successful
export function isOk<T>(result: ActionResult<T>): result is { success: true; data: T } {
  return result.success === true
}

// Type guard to check if result is error
export function isErr<T>(
  result: ActionResult<T>
): result is { success: false; error: string; code?: string; field?: string } {
  return result.success === false
}
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes

---

## Task 6: Add Health Endpoints

**Files:**

- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/health/ready/route.ts`

**Step 1: Create liveness health endpoint**

```typescript
// src/app/api/health/route.ts
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
  })
}
```

**Step 2: Create readiness health endpoint**

```typescript
// src/app/api/health/ready/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Check database connectivity
    await db.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: "ready",
      timestamp: new Date().toISOString(),
      checks: {
        database: "ok",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "not_ready",
        timestamp: new Date().toISOString(),
        checks: {
          database: "failed",
        },
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    )
  }
}
```

**Verification:**

- Run: `curl http://localhost:3002/api/health`
- Expected: `{"status":"ok","timestamp":"...","version":"0.1.0"}`

---

## Task 7: Add Structured Logging (Pino)

**Files:**

- Modify: `package.json` (add pino dependency)
- Create: `src/lib/logger.ts`

**Step 1: Install Pino**

```bash
npm install pino pino-pretty
npm install -D @types/pino
```

**Step 2: Create logger module**

```typescript
// src/lib/logger.ts
import pino from "pino"

const isDev = process.env.NODE_ENV !== "production"

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
  base: {
    env: process.env.NODE_ENV,
    app: "fiskai",
  },
  redact: {
    paths: ["password", "passwordHash", "apiKey", "secret", "token"],
    censor: "[REDACTED]",
  },
})

// Create child loggers for different contexts
export const createLogger = (context: string) => logger.child({ context })

// Pre-configured loggers for common use cases
export const authLogger = createLogger("auth")
export const dbLogger = createLogger("database")
export const invoiceLogger = createLogger("e-invoice")
export const apiLogger = createLogger("api")
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes

---

## Task 8: Add Company Switcher to Header

**Files:**

- Create: `src/components/layout/company-switcher.tsx`
- Modify: `src/components/layout/header.tsx`
- Create: `src/app/actions/company-switch.ts`

**Step 1: Create company switcher action**

```typescript
// src/app/actions/company-switch.ts
"use server"

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"

export async function switchCompany(companyId: string) {
  const user = await requireAuth()

  // Verify user has access to this company
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId: companyId,
    },
  })

  if (!companyUser) {
    return { error: "Nemate pristup ovoj tvrtki" }
  }

  // Update default company
  await db.$transaction([
    // Remove default from all user's companies
    db.companyUser.updateMany({
      where: { userId: user.id! },
      data: { isDefault: false },
    }),
    // Set new default
    db.companyUser.update({
      where: { id: companyUser.id },
      data: { isDefault: true },
    }),
  ])

  revalidatePath("/")
  return { success: true }
}

export async function getUserCompanies() {
  const user = await requireAuth()

  const companies = await db.companyUser.findMany({
    where: { userId: user.id! },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          oib: true,
        },
      },
    },
    orderBy: { company: { name: "asc" } },
  })

  return companies.map((cu) => ({
    id: cu.company.id,
    name: cu.company.name,
    oib: cu.company.oib,
    isDefault: cu.isDefault,
    role: cu.role,
  }))
}
```

**Step 2: Create company switcher component**

```tsx
// src/components/layout/company-switcher.tsx
"use client"

import { useState, useTransition } from "react"
import { switchCompany } from "@/app/actions/company-switch"

type Company = {
  id: string
  name: string
  oib: string
  isDefault: boolean
  role: string
}

export function CompanySwitcher({
  companies,
  currentCompanyId,
}: {
  companies: Company[]
  currentCompanyId: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const currentCompany = companies.find((c) => c.id === currentCompanyId)

  if (companies.length <= 1) {
    return <div className="text-sm text-gray-600">{currentCompany?.name}</div>
  }

  const handleSwitch = (companyId: string) => {
    startTransition(async () => {
      await switchCompany(companyId)
      setIsOpen(false)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        disabled={isPending}
      >
        <span className="max-w-[150px] truncate">{currentCompany?.name}</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {companies.map((company) => (
            <button
              key={company.id}
              onClick={() => handleSwitch(company.id)}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                company.id === currentCompanyId ? "bg-blue-50 text-blue-700" : ""
              }`}
              disabled={isPending}
            >
              <div>
                <div className="font-medium">{company.name}</div>
                <div className="text-xs text-gray-500">OIB: {company.oib}</div>
              </div>
              {company.id === currentCompanyId && (
                <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Update header to include company switcher**

```tsx
// src/components/layout/header.tsx
import Link from "next/link"
import { auth } from "@/lib/auth"
import { logout } from "@/app/actions/auth"
import { getUserCompanies } from "@/app/actions/company-switch"
import { getCurrentCompany } from "@/lib/auth-utils"
import { Button } from "@/components/ui/button"
import { CompanySwitcher } from "./company-switcher"

export async function Header() {
  const session = await auth()
  let companies: Awaited<ReturnType<typeof getUserCompanies>> = []
  let currentCompany: Awaited<ReturnType<typeof getCurrentCompany>> | null = null

  if (session?.user?.id) {
    try {
      companies = await getUserCompanies()
      currentCompany = await getCurrentCompany(session.user.id)
    } catch {
      // User not fully set up yet
    }
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-blue-600">
            FiskAI
          </Link>
          {currentCompany && companies.length > 0 && (
            <CompanySwitcher companies={companies} currentCompanyId={currentCompany.id} />
          )}
        </div>

        <nav className="flex items-center gap-4">
          {session?.user ? (
            <>
              <span className="text-sm text-gray-600">{session.user.email}</span>
              <form action={logout}>
                <Button variant="outline" size="sm" type="submit">
                  Odjava
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Prijava
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Registracija</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes

---

## Task 9: Enhance Dashboard with Insights/KPIs

**Files:**

- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Update dashboard with financial KPIs**

```tsx
// src/app/(dashboard)/dashboard/page.tsx
import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Decimal } from "@prisma/client/runtime/library"
import Link from "next/link"

export default async function DashboardPage() {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
    redirect("/onboarding")
  }

  // Get counts and financial data
  const [
    eInvoiceCount,
    contactCount,
    productCount,
    draftInvoices,
    pendingInvoices,
    recentInvoices,
    totalRevenue,
  ] = await Promise.all([
    db.eInvoice.count({ where: { companyId: company.id } }),
    db.contact.count({ where: { companyId: company.id } }),
    db.product.count({ where: { companyId: company.id } }),
    db.eInvoice.count({
      where: { companyId: company.id, status: "DRAFT" },
    }),
    db.eInvoice.count({
      where: {
        companyId: company.id,
        status: { in: ["PENDING_FISCALIZATION", "SENT"] },
      },
    }),
    db.eInvoice.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        buyer: { select: { name: true } },
      },
    }),
    db.eInvoice.aggregate({
      where: {
        companyId: company.id,
        status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
      },
      _sum: { totalAmount: true },
    }),
  ])

  const totalRevenueValue = totalRevenue._sum.totalAmount || new Decimal(0)

  const statusLabels: Record<string, string> = {
    DRAFT: "Nacrt",
    PENDING_FISCALIZATION: "Fiskalizacija",
    FISCALIZED: "Fiskalizirano",
    SENT: "Poslano",
    DELIVERED: "Dostavljeno",
    ACCEPTED: "Prihvaceno",
    REJECTED: "Odbijeno",
    ERROR: "Greska",
  }

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    PENDING_FISCALIZATION: "bg-yellow-100 text-yellow-700",
    FISCALIZED: "bg-blue-100 text-blue-700",
    SENT: "bg-purple-100 text-purple-700",
    DELIVERED: "bg-green-100 text-green-700",
    ACCEPTED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    ERROR: "bg-red-100 text-red-700",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dobrodosli, {user.name || user.email}</h1>
          <p className="text-gray-600">{company.name}</p>
        </div>
        <Link
          href="/e-invoices/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Novi e-racun
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Ukupni prihod</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{totalRevenueValue.toFixed(2)} EUR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">E-Racuni</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{eInvoiceCount}</p>
            {draftInvoices > 0 && (
              <p className="text-sm text-yellow-600">{draftInvoices} u nacrtu</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Kontakti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{contactCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Proizvodi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{productCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(draftInvoices > 0 || pendingInvoices > 0 || !company.eInvoiceProvider) && (
        <div className="space-y-2">
          {!company.eInvoiceProvider && (
            <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-4">
              <span className="text-red-600">!</span>
              <div className="flex-1">
                <p className="font-medium text-red-800">E-racuni nisu konfigurirani</p>
                <p className="text-sm text-red-600">Konfigurirajte posrednika u postavkama</p>
              </div>
              <Link
                href="/settings"
                className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
              >
                Postavke
              </Link>
            </div>
          )}
          {draftInvoices > 0 && (
            <div className="flex items-center gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-4">
              <span className="text-yellow-600">i</span>
              <div className="flex-1">
                <p className="font-medium text-yellow-800">{draftInvoices} racuna u nacrtu</p>
                <p className="text-sm text-yellow-600">Zavrssite ih i posaljite</p>
              </div>
              <Link
                href="/e-invoices?status=DRAFT"
                className="rounded bg-yellow-600 px-3 py-1 text-sm text-white hover:bg-yellow-700"
              >
                Pregledaj
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Nedavni e-racuni</span>
              <Link
                href="/e-invoices"
                className="text-sm font-normal text-blue-600 hover:underline"
              >
                Vidi sve
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Nema e-racuna</p>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/e-invoices/${invoice.id}`}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-gray-500">{invoice.buyer?.name || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{Number(invoice.totalAmount).toFixed(2)} EUR</p>
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs ${
                          statusColors[invoice.status] || "bg-gray-100"
                        }`}
                      >
                        {statusLabels[invoice.status] || invoice.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fiskalizacija Status */}
        <Card>
          <CardHeader>
            <CardTitle>Fiskalizacija 2.0 Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border p-3">
                <span>PDV obveznik</span>
                <span
                  className={`rounded px-2 py-1 text-sm ${
                    company.isVatPayer ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {company.isVatPayer ? "Da" : "Ne"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span>Posrednik</span>
                <span
                  className={`rounded px-2 py-1 text-sm ${
                    company.eInvoiceProvider
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {company.eInvoiceProvider || "Nije konfiguriran"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span>OIB</span>
                <span className="font-mono text-sm">{company.oib}</span>
              </div>
              {company.vatNumber && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span>PDV broj</span>
                  <span className="font-mono text-sm">{company.vatNumber}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Verification:**

- Run: `npm run build`
- Expected: Build passes

---

## Task 10: Commit All Changes

**Step 1: Stage all changes**

```bash
git add -A
```

**Step 2: Commit with descriptive message**

```bash
git commit -m "feat: implement audit phase 2 - infrastructure, security, and UX improvements

- Split docker-compose into dev/prod configurations
- Fix Dockerfile with ARM64 platform pin
- Add npm scripts for Prisma commands (db:generate, db:push, db:migrate)
- Add Prisma middleware for automatic tenant filtering
- Add structured ActionResult type for server actions
- Add health check endpoints (/api/health, /api/health/ready)
- Add structured logging with Pino
- Add company switcher to header for multi-company users
- Enhance dashboard with financial KPIs and insights

Addresses audit findings from implementation-plan.md phases 1-7"
```

**Verification:**

- Run: `git log --oneline -1`
- Expected: Shows new commit with message

---

## Verification Checklist

After all tasks complete:

1. `npm run build` - Must pass with no errors
2. `npm run lint` - Should pass (warnings OK)
3. `curl http://localhost:3002/api/health` - Returns JSON with status "ok"
4. `curl http://localhost:3002/api/health/ready` - Returns JSON with database "ok"
5. Dashboard shows KPIs, alerts, and recent invoices
6. Company switcher appears in header (if user has multiple companies)
7. Docker compose files validate: `docker compose -f docker-compose.yml -f docker-compose.prod.yml config`
