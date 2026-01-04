# FiskAI Phase 1: Core + E-Invoicing MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the foundational Next.js application with authentication, company management, and e-invoicing module ready for Fiskalizacija 2.0 compliance.

**Architecture:** Multi-tenant SaaS with single PostgreSQL database using company_id isolation. Next.js App Router with Server Actions for mutations. Provider-agnostic e-invoice adapter pattern.

**Tech Stack:** Next.js 14+, TypeScript, PostgreSQL, Prisma, NextAuth.js, Tailwind CSS, Zod, React Hook Form

---

## Prerequisites

Before starting, ensure:

- Node.js 20+ installed
- PostgreSQL 16 running (locally or Docker)
- Git configured
- Working directory: `/home/admin/FiskAI`

---

## Task 1: Initialize Next.js Project

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `.env.local`
- Create: `.gitignore`

**Step 1: Create Next.js application with TypeScript**

Run:

```bash
cd /home/admin/FiskAI
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: Project initialized with Next.js 14+, TypeScript, Tailwind, App Router

**Step 2: Verify installation**

Run:

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -20
pkill -f "next dev"
```

Expected: HTML response from Next.js dev server

**Step 3: Install core dependencies**

Run:

```bash
npm install @prisma/client next-auth@beta @auth/prisma-adapter zod react-hook-form @hookform/resolvers zustand @tanstack/react-query bcryptjs
npm install -D prisma @types/bcryptjs
```

Expected: Dependencies installed successfully

**Step 4: Create environment file**

Create `.env.local`:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fiskai?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-development-secret-change-in-production"

# App
NEXT_PUBLIC_APP_NAME="FiskAI"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Step 5: Update .gitignore**

Append to `.gitignore`:

```
# Environment
.env.local
.env.production

# Database
*.db
*.sqlite

# IDE
.idea/
.vscode/
```

**Step 6: Commit**

Run:

```bash
git add -A
git commit -m "feat: initialize Next.js 14 project with TypeScript and Tailwind"
```

---

## Task 2: Set Up Prisma Schema (Core Models)

**Files:**

- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

**Step 1: Initialize Prisma**

Run:

```bash
npx prisma init
```

Expected: `prisma/schema.prisma` and `.env` created

**Step 2: Write Core database schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// CORE MODULE - Authentication & Multi-tenancy
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  emailVerified DateTime?
  image         String?
  passwordHash  String?

  // Relations
  accounts      Account[]
  sessions      Session[]
  companies     CompanyUser[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============================================
// CORE MODULE - Company & Multi-tenancy
// ============================================

model Company {
  id            String    @id @default(cuid())
  name          String
  oib           String    @unique
  vatNumber     String?
  address       String
  city          String
  postalCode    String
  country       String    @default("HR")
  email         String?
  phone         String?
  iban          String?
  isVatPayer    Boolean   @default(false)

  // E-invoice settings
  eInvoiceProvider    String?
  eInvoiceApiKey      String?

  // Relations
  users         CompanyUser[]
  contacts      Contact[]
  products      Product[]
  eInvoices     EInvoice[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model CompanyUser {
  id        String   @id @default(cuid())
  userId    String
  companyId String
  role      Role     @default(MEMBER)
  isDefault Boolean  @default(false)

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, companyId])
  @@index([userId])
  @@index([companyId])
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  ACCOUNTANT
  VIEWER
}

// ============================================
// CORE MODULE - Contacts & Products
// ============================================

model Contact {
  id            String      @id @default(cuid())
  companyId     String
  type          ContactType
  name          String
  oib           String?
  vatNumber     String?
  address       String?
  city          String?
  postalCode    String?
  country       String      @default("HR")
  email         String?
  phone         String?

  company       Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // E-Invoice relations
  eInvoicesAsBuyer  EInvoice[] @relation("EInvoiceBuyer")
  eInvoicesAsSeller EInvoice[] @relation("EInvoiceSeller")

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([companyId])
  @@index([oib])
}

enum ContactType {
  CUSTOMER
  SUPPLIER
  BOTH
}

model Product {
  id          String   @id @default(cuid())
  companyId   String
  name        String
  description String?
  sku         String?
  unit        String   @default("C62")
  price       Decimal  @db.Decimal(10, 2)
  vatRate     Decimal  @db.Decimal(5, 2) @default(25)
  vatCategory String   @default("S")
  isActive    Boolean  @default(true)

  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([companyId])
}

// ============================================
// E-INVOICING MODULE
// ============================================

model EInvoice {
  id              String           @id @default(cuid())
  companyId       String
  direction       EInvoiceDirection

  // Parties
  sellerId        String?
  buyerId         String?

  // Invoice data
  invoiceNumber   String
  issueDate       DateTime
  dueDate         DateTime?
  currency        String           @default("EUR")
  buyerReference  String?

  // Amounts
  netAmount       Decimal          @db.Decimal(10, 2)
  vatAmount       Decimal          @db.Decimal(10, 2)
  totalAmount     Decimal          @db.Decimal(10, 2)

  // Status
  status          EInvoiceStatus   @default(DRAFT)

  // Fiscalization
  jir             String?
  zki             String?
  fiscalizedAt    DateTime?

  // XML storage
  ublXml          String?          @db.Text

  // Provider
  providerRef     String?
  providerStatus  String?
  providerError   String?

  // Archival
  archivedAt      DateTime?
  archiveRef      String?

  // Relations
  company         Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  seller          Contact?         @relation("EInvoiceSeller", fields: [sellerId], references: [id])
  buyer           Contact?         @relation("EInvoiceBuyer", fields: [buyerId], references: [id])
  lines           EInvoiceLine[]

  // Timestamps
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  sentAt          DateTime?
  receivedAt      DateTime?

  @@index([companyId])
  @@index([status])
  @@index([invoiceNumber])
  @@index([direction])
}

enum EInvoiceDirection {
  OUTBOUND
  INBOUND
}

enum EInvoiceStatus {
  DRAFT
  PENDING_FISCALIZATION
  FISCALIZED
  SENT
  DELIVERED
  ACCEPTED
  REJECTED
  ARCHIVED
  ERROR
}

model EInvoiceLine {
  id          String   @id @default(cuid())
  eInvoiceId  String
  lineNumber  Int
  description String
  quantity    Decimal  @db.Decimal(10, 3)
  unit        String   @default("C62")
  unitPrice   Decimal  @db.Decimal(10, 2)
  netAmount   Decimal  @db.Decimal(10, 2)
  vatRate     Decimal  @db.Decimal(5, 2)
  vatCategory String   @default("S")
  vatAmount   Decimal  @db.Decimal(10, 2)

  eInvoice    EInvoice @relation(fields: [eInvoiceId], references: [id], onDelete: Cascade)

  @@index([eInvoiceId])
}
```

**Step 3: Create Prisma client singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

**Step 4: Generate Prisma client and create migration**

Run:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Expected: Migration created and applied, Prisma client generated

**Step 5: Commit**

Run:

```bash
git add -A
git commit -m "feat: add Prisma schema with core and e-invoicing models"
```

---

## Task 3: Configure NextAuth.js Authentication

**Files:**

- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/auth-utils.ts`

**Step 1: Create NextAuth configuration**

Create `src/lib/auth.ts`:

```typescript
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!passwordMatch) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
```

**Step 2: Create auth API route**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
```

**Step 3: Create auth utility functions**

Create `src/lib/auth-utils.ts`:

```typescript
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"

export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  return user
}

export async function getCurrentCompany(userId: string) {
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId,
      isDefault: true,
    },
    include: {
      company: true,
    },
  })

  if (!companyUser) {
    // Get first company if no default
    const firstCompany = await db.companyUser.findFirst({
      where: { userId },
      include: { company: true },
    })
    return firstCompany?.company ?? null
  }

  return companyUser.company
}

export async function requireCompany(userId: string) {
  const company = await getCurrentCompany(userId)
  if (!company) {
    redirect("/onboarding")
  }
  return company
}
```

**Step 4: Add NextAuth types**

Create `src/types/next-auth.d.ts`:

```typescript
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}
```

**Step 5: Commit**

Run:

```bash
git add -A
git commit -m "feat: configure NextAuth.js with credentials and Google providers"
```

---

## Task 4: Create Zod Validation Schemas

**Files:**

- Create: `src/lib/validations/auth.ts`
- Create: `src/lib/validations/company.ts`
- Create: `src/lib/validations/contact.ts`
- Create: `src/lib/validations/e-invoice.ts`

**Step 1: Create auth validation schemas**

Create `src/lib/validations/auth.ts`:

```typescript
import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
```

**Step 2: Create company validation schemas**

Create `src/lib/validations/company.ts`:

```typescript
import { z } from "zod"

// Croatian OIB validation (11 digits with checksum)
const oibRegex = /^\d{11}$/

export const companySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  oib: z.string().regex(oibRegex, "OIB must be exactly 11 digits"),
  vatNumber: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().default("HR"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  iban: z.string().optional(),
  isVatPayer: z.boolean().default(false),
})

export const companySettingsSchema = z.object({
  eInvoiceProvider: z.enum(["ie-racuni", "fina", "ddd-invoices"]).optional(),
  eInvoiceApiKey: z.string().optional(),
})

export type CompanyInput = z.infer<typeof companySchema>
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>
```

**Step 3: Create contact validation schemas**

Create `src/lib/validations/contact.ts`:

```typescript
import { z } from "zod"

export const contactSchema = z.object({
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  name: z.string().min(2, "Name must be at least 2 characters"),
  oib: z
    .string()
    .regex(/^\d{11}$/, "OIB must be exactly 11 digits")
    .optional()
    .or(z.literal("")),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("HR"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
})

export type ContactInput = z.infer<typeof contactSchema>
```

**Step 4: Create e-invoice validation schemas**

Create `src/lib/validations/e-invoice.ts`:

```typescript
import { z } from "zod"

export const eInvoiceLineSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().default("C62"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
  vatRate: z.number().min(0).max(100).default(25),
  vatCategory: z.enum(["S", "AA", "E", "Z", "O"]).default("S"),
})

export const eInvoiceSchema = z.object({
  buyerId: z.string().min(1, "Buyer is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  currency: z.string().default("EUR"),
  buyerReference: z.string().optional(),
  lines: z.array(eInvoiceLineSchema).min(1, "At least one line item is required"),
})

export type EInvoiceLineInput = z.infer<typeof eInvoiceLineSchema>
export type EInvoiceInput = z.infer<typeof eInvoiceSchema>
```

**Step 5: Create index file**

Create `src/lib/validations/index.ts`:

```typescript
export * from "./auth"
export * from "./company"
export * from "./contact"
export * from "./e-invoice"
```

**Step 6: Commit**

Run:

```bash
git add -A
git commit -m "feat: add Zod validation schemas for all entities"
```

---

## Task 5: Create Server Actions for Authentication

**Files:**

- Create: `src/app/actions/auth.ts`

**Step 1: Create authentication server actions**

Create `src/app/actions/auth.ts`:

```typescript
"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { signIn, signOut } from "@/lib/auth"
import { registerSchema, loginSchema } from "@/lib/validations"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"

export async function register(formData: z.infer<typeof registerSchema>) {
  const validatedFields = registerSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields" }
  }

  const { name, email, password } = validatedFields.data

  const existingUser = await db.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { error: "Email already in use" }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await db.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  })

  return { success: "Account created! Please log in." }
}

export async function login(formData: z.infer<typeof loginSchema>) {
  const validatedFields = loginSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields" }
  }

  const { email, password } = validatedFields.data

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials" }
        default:
          return { error: "Something went wrong" }
      }
    }
    throw error
  }

  redirect("/dashboard")
}

export async function logout() {
  await signOut({ redirect: false })
  redirect("/login")
}
```

**Step 2: Commit**

Run:

```bash
git add -A
git commit -m "feat: add server actions for authentication"
```

---

## Task 6: Create Server Actions for Company Management

**Files:**

- Create: `src/app/actions/company.ts`

**Step 1: Create company server actions**

Create `src/app/actions/company.ts`:

```typescript
"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import { companySchema, companySettingsSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createCompany(formData: z.infer<typeof companySchema>) {
  const user = await requireAuth()

  const validatedFields = companySchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields", details: validatedFields.error.flatten() }
  }

  const data = validatedFields.data

  // Check if OIB already exists
  const existingCompany = await db.company.findUnique({
    where: { oib: data.oib },
  })

  if (existingCompany) {
    return { error: "A company with this OIB already exists" }
  }

  // Create company and link to user as owner
  const company = await db.company.create({
    data: {
      ...data,
      vatNumber: data.isVatPayer ? `HR${data.oib}` : null,
      users: {
        create: {
          userId: user.id!,
          role: "OWNER",
          isDefault: true,
        },
      },
    },
  })

  revalidatePath("/dashboard")
  redirect("/dashboard")
}

export async function updateCompany(companyId: string, formData: z.infer<typeof companySchema>) {
  const user = await requireAuth()

  // Verify user has access to this company
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
      role: { in: ["OWNER", "ADMIN"] },
    },
  })

  if (!companyUser) {
    return { error: "Unauthorized" }
  }

  const validatedFields = companySchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields", details: validatedFields.error.flatten() }
  }

  const data = validatedFields.data

  await db.company.update({
    where: { id: companyId },
    data: {
      ...data,
      vatNumber: data.isVatPayer ? `HR${data.oib}` : null,
    },
  })

  revalidatePath("/dashboard")
  return { success: "Company updated" }
}

export async function updateCompanySettings(
  companyId: string,
  formData: z.infer<typeof companySettingsSchema>
) {
  const user = await requireAuth()

  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
      role: { in: ["OWNER", "ADMIN"] },
    },
  })

  if (!companyUser) {
    return { error: "Unauthorized" }
  }

  const validatedFields = companySettingsSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields" }
  }

  await db.company.update({
    where: { id: companyId },
    data: validatedFields.data,
  })

  revalidatePath("/settings")
  return { success: "Settings updated" }
}

export async function switchCompany(companyId: string) {
  const user = await requireAuth()

  // Verify user has access
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId: user.id!,
      companyId,
    },
  })

  if (!companyUser) {
    return { error: "Unauthorized" }
  }

  // Set as default
  await db.companyUser.updateMany({
    where: { userId: user.id! },
    data: { isDefault: false },
  })

  await db.companyUser.update({
    where: { id: companyUser.id },
    data: { isDefault: true },
  })

  revalidatePath("/dashboard")
  return { success: "Company switched" }
}

export async function getUserCompanies() {
  const user = await requireAuth()

  return db.companyUser.findMany({
    where: { userId: user.id! },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  })
}
```

**Step 2: Commit**

Run:

```bash
git add -A
git commit -m "feat: add server actions for company management"
```

---

## Task 7: Create Server Actions for Contacts

**Files:**

- Create: `src/app/actions/contact.ts`

**Step 1: Create contact server actions**

Create `src/app/actions/contact.ts`:

```typescript
"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { contactSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

export async function createContact(formData: z.infer<typeof contactSchema>) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const validatedFields = contactSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields", details: validatedFields.error.flatten() }
  }

  const contact = await db.contact.create({
    data: {
      ...validatedFields.data,
      companyId: company.id,
    },
  })

  revalidatePath("/contacts")
  return { success: "Contact created", data: contact }
}

export async function updateContact(contactId: string, formData: z.infer<typeof contactSchema>) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  // Verify contact belongs to company
  const existingContact = await db.contact.findFirst({
    where: {
      id: contactId,
      companyId: company.id,
    },
  })

  if (!existingContact) {
    return { error: "Contact not found" }
  }

  const validatedFields = contactSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields", details: validatedFields.error.flatten() }
  }

  const contact = await db.contact.update({
    where: { id: contactId },
    data: validatedFields.data,
  })

  revalidatePath("/contacts")
  return { success: "Contact updated", data: contact }
}

export async function deleteContact(contactId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const contact = await db.contact.findFirst({
    where: {
      id: contactId,
      companyId: company.id,
    },
  })

  if (!contact) {
    return { error: "Contact not found" }
  }

  await db.contact.delete({
    where: { id: contactId },
  })

  revalidatePath("/contacts")
  return { success: "Contact deleted" }
}

export async function getContacts(type?: "CUSTOMER" | "SUPPLIER" | "BOTH") {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return db.contact.findMany({
    where: {
      companyId: company.id,
      ...(type && { type }),
    },
    orderBy: { name: "asc" },
  })
}

export async function searchContacts(query: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return db.contact.findMany({
    where: {
      companyId: company.id,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { oib: { contains: query } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 10,
    orderBy: { name: "asc" },
  })
}
```

**Step 2: Commit**

Run:

```bash
git add -A
git commit -m "feat: add server actions for contact management"
```

---

## Task 8: Create E-Invoice Provider Interface and Mock Provider

**Files:**

- Create: `src/lib/e-invoice/types.ts`
- Create: `src/lib/e-invoice/provider.ts`
- Create: `src/lib/e-invoice/providers/mock.ts`

**Step 1: Create e-invoice types**

Create `src/lib/e-invoice/types.ts`:

```typescript
import { EInvoice, EInvoiceLine, Contact, Company } from "@prisma/client"

export interface EInvoiceWithRelations extends EInvoice {
  lines: EInvoiceLine[]
  buyer: Contact | null
  seller: Contact | null
  company: Company
}

export interface SendInvoiceResult {
  success: boolean
  providerRef?: string
  jir?: string
  zki?: string
  error?: string
}

export interface IncomingInvoice {
  providerRef: string
  sellerOib: string
  sellerName: string
  invoiceNumber: string
  issueDate: Date
  totalAmount: number
  currency: string
  ublXml: string
}

export interface InvoiceStatusResult {
  status: "pending" | "delivered" | "accepted" | "rejected" | "error"
  message?: string
  updatedAt: Date
}

export interface ArchiveResult {
  success: boolean
  archiveRef?: string
  error?: string
}

export interface ProviderConfig {
  apiKey: string
  apiUrl?: string
  sandbox?: boolean
}
```

**Step 2: Create provider interface**

Create `src/lib/e-invoice/provider.ts`:

```typescript
import {
  EInvoiceWithRelations,
  SendInvoiceResult,
  IncomingInvoice,
  InvoiceStatusResult,
  ArchiveResult,
  ProviderConfig,
} from "./types"

export interface EInvoiceProvider {
  readonly name: string

  sendInvoice(invoice: EInvoiceWithRelations, ublXml: string): Promise<SendInvoiceResult>

  fetchIncomingInvoices(): Promise<IncomingInvoice[]>

  getInvoiceStatus(providerRef: string): Promise<InvoiceStatusResult>

  archiveInvoice(invoice: EInvoiceWithRelations): Promise<ArchiveResult>

  testConnection(): Promise<boolean>
}

export function createEInvoiceProvider(
  providerName: string,
  config: ProviderConfig
): EInvoiceProvider {
  switch (providerName) {
    case "mock":
      // Dynamic import to avoid bundling all providers
      const { MockProvider } = require("./providers/mock")
      return new MockProvider(config)
    case "ie-racuni":
      throw new Error("IE Računi provider not yet implemented")
    case "fina":
      throw new Error("Fina provider not yet implemented")
    default:
      throw new Error(`Unknown provider: ${providerName}`)
  }
}
```

**Step 3: Create mock provider for development**

Create `src/lib/e-invoice/providers/mock.ts`:

```typescript
import {
  EInvoiceProvider,
  EInvoiceWithRelations,
  SendInvoiceResult,
  IncomingInvoice,
  InvoiceStatusResult,
  ArchiveResult,
  ProviderConfig,
} from "../types"

export class MockProvider implements EInvoiceProvider {
  readonly name = "Mock Provider (Development)"

  constructor(private config: ProviderConfig) {}

  async sendInvoice(invoice: EInvoiceWithRelations, ublXml: string): Promise<SendInvoiceResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Generate mock fiscalization codes
    const jir = `JIR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const zki = `ZKI-${Math.random().toString(36).substr(2, 20)}`

    console.log(`[MockProvider] Sending invoice ${invoice.invoiceNumber}`)
    console.log(`[MockProvider] UBL XML length: ${ublXml.length} bytes`)

    return {
      success: true,
      providerRef: `MOCK-${Date.now()}`,
      jir,
      zki,
    }
  }

  async fetchIncomingInvoices(): Promise<IncomingInvoice[]> {
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Return empty array for mock - in real implementation would fetch from API
    return []
  }

  async getInvoiceStatus(providerRef: string): Promise<InvoiceStatusResult> {
    await new Promise((resolve) => setTimeout(resolve, 200))

    return {
      status: "delivered",
      message: "Invoice delivered successfully (mock)",
      updatedAt: new Date(),
    }
  }

  async archiveInvoice(invoice: EInvoiceWithRelations): Promise<ArchiveResult> {
    await new Promise((resolve) => setTimeout(resolve, 300))

    return {
      success: true,
      archiveRef: `ARCHIVE-${invoice.id}-${Date.now()}`,
    }
  }

  async testConnection(): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return true
  }
}
```

**Step 4: Create index file**

Create `src/lib/e-invoice/index.ts`:

```typescript
export * from "./types"
export * from "./provider"
```

**Step 5: Commit**

Run:

```bash
git add -A
git commit -m "feat: add e-invoice provider interface with mock implementation"
```

---

## Task 9: Create UBL XML Generator

**Files:**

- Create: `src/lib/e-invoice/ubl-generator.ts`

**Step 1: Create UBL generator**

Create `src/lib/e-invoice/ubl-generator.ts`:

```typescript
import { EInvoiceWithRelations } from "./types"
import { Company, Contact, EInvoiceLine } from "@prisma/client"

const UBL_NAMESPACES = {
  invoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
}

const CUSTOMIZATION_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"
const PROFILE_ID = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

function formatDecimal(value: number | string, decimals: number = 2): string {
  return Number(value).toFixed(decimals)
}

function generatePartyXml(party: Contact | Company, isSupplier: boolean): string {
  const oib = "oib" in party ? party.oib : null
  const vatNumber = "vatNumber" in party ? party.vatNumber : null

  return `
    <cac:${isSupplier ? "AccountingSupplierParty" : "AccountingCustomerParty"}>
      <cac:Party>
        ${oib ? `<cbc:EndpointID schemeID="0191">${escapeXml(oib)}</cbc:EndpointID>` : ""}
        <cac:PartyIdentification>
          <cbc:ID${oib ? ' schemeID="0191"' : ""}>${escapeXml(oib || "")}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyName>
          <cbc:Name>${escapeXml(party.name)}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>${escapeXml(party.address || "")}</cbc:StreetName>
          <cbc:CityName>${escapeXml(party.city || "")}</cbc:CityName>
          <cbc:PostalZone>${escapeXml(party.postalCode || "")}</cbc:PostalZone>
          <cac:Country>
            <cbc:IdentificationCode>${escapeXml(party.country || "HR")}</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>
        ${
          vatNumber
            ? `
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${escapeXml(vatNumber)}</cbc:CompanyID>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:PartyTaxScheme>`
            : ""
        }
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escapeXml(party.name)}</cbc:RegistrationName>
          ${oib ? `<cbc:CompanyID schemeID="0191">${escapeXml(oib)}</cbc:CompanyID>` : ""}
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:${isSupplier ? "AccountingSupplierParty" : "AccountingCustomerParty"}>`
}

function generateInvoiceLineXml(line: EInvoiceLine): string {
  return `
    <cac:InvoiceLine>
      <cbc:ID>${line.lineNumber}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${escapeXml(line.unit)}">${formatDecimal(line.quantity, 3)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="EUR">${formatDecimal(line.netAmount)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(line.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${escapeXml(line.vatCategory)}</cbc:ID>
          <cbc:Percent>${formatDecimal(line.vatRate)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="EUR">${formatDecimal(line.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`
}

export function generateUBLInvoice(invoice: EInvoiceWithRelations): string {
  if (!invoice.buyer) {
    throw new Error("Invoice must have a buyer")
  }

  const { company, buyer, lines } = invoice

  // Group lines by VAT rate for tax subtotals
  const taxSubtotals = lines.reduce(
    (acc, line) => {
      const key = `${line.vatCategory}-${line.vatRate}`
      if (!acc[key]) {
        acc[key] = {
          category: line.vatCategory,
          rate: Number(line.vatRate),
          taxableAmount: 0,
          taxAmount: 0,
        }
      }
      acc[key].taxableAmount += Number(line.netAmount)
      acc[key].taxAmount += Number(line.vatAmount)
      return acc
    },
    {} as Record<
      string,
      {
        category: string
        rate: number
        taxableAmount: number
        taxAmount: number
      }
    >
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${UBL_NAMESPACES.invoice}"
         xmlns:cac="${UBL_NAMESPACES.cac}"
         xmlns:cbc="${UBL_NAMESPACES.cbc}">
  <cbc:CustomizationID>${CUSTOMIZATION_ID}</cbc:CustomizationID>
  <cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${formatDate(invoice.issueDate)}</cbc:IssueDate>
  ${invoice.dueDate ? `<cbc:DueDate>${formatDate(invoice.dueDate)}</cbc:DueDate>` : ""}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escapeXml(invoice.currency)}</cbc:DocumentCurrencyCode>
  ${invoice.buyerReference ? `<cbc:BuyerReference>${escapeXml(invoice.buyerReference)}</cbc:BuyerReference>` : ""}

  ${generatePartyXml(company, true)}
  ${generatePartyXml(buyer, false)}

  ${
    company.iban
      ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml(company.iban)}</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
      : ""
  }

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${formatDecimal(invoice.vatAmount)}</cbc:TaxAmount>
    ${Object.values(taxSubtotals)
      .map(
        (subtotal) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${formatDecimal(subtotal.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${formatDecimal(subtotal.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${escapeXml(subtotal.category)}</cbc:ID>
        <cbc:Percent>${formatDecimal(subtotal.rate)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`
      )
      .join("")}
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${formatDecimal(invoice.netAmount)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${formatDecimal(invoice.netAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${formatDecimal(invoice.totalAmount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${formatDecimal(invoice.totalAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  ${lines.map(generateInvoiceLineXml).join("")}
</Invoice>`

  return xml.trim()
}
```

**Step 2: Update index**

Update `src/lib/e-invoice/index.ts`:

```typescript
export * from "./types"
export * from "./provider"
export * from "./ubl-generator"
```

**Step 3: Commit**

Run:

```bash
git add -A
git commit -m "feat: add UBL 2.1 XML generator for PEPPOL BIS 3.0 compliance"
```

---

## Task 10: Create E-Invoice Server Actions

**Files:**

- Create: `src/app/actions/e-invoice.ts`

**Step 1: Create e-invoice server actions**

Create `src/app/actions/e-invoice.ts`:

```typescript
"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoiceProvider, generateUBLInvoice } from "@/lib/e-invoice"
import { revalidatePath } from "next/cache"
import { Decimal } from "@prisma/client/runtime/library"

export async function createEInvoice(formData: z.infer<typeof eInvoiceSchema>) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const validatedFields = eInvoiceSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields", details: validatedFields.error.flatten() }
  }

  const { buyerId, lines, ...invoiceData } = validatedFields.data

  // Calculate totals
  const lineItems = lines.map((line, index) => {
    const netAmount = line.quantity * line.unitPrice
    const vatAmount = netAmount * (line.vatRate / 100)
    return {
      lineNumber: index + 1,
      description: line.description,
      quantity: new Decimal(line.quantity),
      unit: line.unit,
      unitPrice: new Decimal(line.unitPrice),
      netAmount: new Decimal(netAmount),
      vatRate: new Decimal(line.vatRate),
      vatCategory: line.vatCategory,
      vatAmount: new Decimal(vatAmount),
    }
  })

  const netAmount = lineItems.reduce((sum, line) => sum + Number(line.netAmount), 0)
  const vatAmount = lineItems.reduce((sum, line) => sum + Number(line.vatAmount), 0)
  const totalAmount = netAmount + vatAmount

  const eInvoice = await db.eInvoice.create({
    data: {
      companyId: company.id,
      direction: "OUTBOUND",
      buyerId,
      invoiceNumber: invoiceData.invoiceNumber,
      issueDate: invoiceData.issueDate,
      dueDate: invoiceData.dueDate,
      currency: invoiceData.currency,
      buyerReference: invoiceData.buyerReference,
      netAmount: new Decimal(netAmount),
      vatAmount: new Decimal(vatAmount),
      totalAmount: new Decimal(totalAmount),
      status: "DRAFT",
      lines: {
        create: lineItems,
      },
    },
    include: {
      lines: true,
      buyer: true,
      seller: true,
      company: true,
    },
  })

  revalidatePath("/e-invoices")
  return { success: "E-Invoice created", data: eInvoice }
}

export async function sendEInvoice(eInvoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const eInvoice = await db.eInvoice.findFirst({
    where: {
      id: eInvoiceId,
      companyId: company.id,
      direction: "OUTBOUND",
      status: "DRAFT",
    },
    include: {
      lines: true,
      buyer: true,
      seller: true,
      company: true,
    },
  })

  if (!eInvoice) {
    return { error: "E-Invoice not found or already sent" }
  }

  // Generate UBL XML
  const ublXml = generateUBLInvoice(eInvoice)

  // Get provider (use mock for now)
  const providerName = company.eInvoiceProvider || "mock"
  const provider = createEInvoiceProvider(providerName, {
    apiKey: company.eInvoiceApiKey || "",
  })

  // Send via provider
  const result = await provider.sendInvoice(eInvoice, ublXml)

  if (!result.success) {
    await db.eInvoice.update({
      where: { id: eInvoiceId },
      data: {
        status: "ERROR",
        providerError: result.error,
      },
    })
    return { error: result.error || "Failed to send invoice" }
  }

  // Update invoice with fiscalization data
  await db.eInvoice.update({
    where: { id: eInvoiceId },
    data: {
      status: "SENT",
      ublXml,
      providerRef: result.providerRef,
      jir: result.jir,
      zki: result.zki,
      fiscalizedAt: result.jir ? new Date() : null,
      sentAt: new Date(),
    },
  })

  revalidatePath("/e-invoices")
  return { success: "E-Invoice sent successfully", data: result }
}

export async function getEInvoices(direction?: "OUTBOUND" | "INBOUND", status?: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return db.eInvoice.findMany({
    where: {
      companyId: company.id,
      ...(direction && { direction }),
      ...(status && { status: status as any }),
    },
    include: {
      buyer: true,
      seller: true,
      lines: true,
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getEInvoice(eInvoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return db.eInvoice.findFirst({
    where: {
      id: eInvoiceId,
      companyId: company.id,
    },
    include: {
      buyer: true,
      seller: true,
      company: true,
      lines: true,
    },
  })
}

export async function deleteEInvoice(eInvoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const eInvoice = await db.eInvoice.findFirst({
    where: {
      id: eInvoiceId,
      companyId: company.id,
      status: "DRAFT",
    },
  })

  if (!eInvoice) {
    return { error: "Can only delete draft invoices" }
  }

  await db.eInvoice.delete({
    where: { id: eInvoiceId },
  })

  revalidatePath("/e-invoices")
  return { success: "E-Invoice deleted" }
}
```

**Step 2: Commit**

Run:

```bash
git add -A
git commit -m "feat: add server actions for e-invoice management"
```

---

## Task 11: Create Basic UI Layout and Components

**Files:**

- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/layout/header.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(dashboard)/layout.tsx`

**Step 1: Create Button component**

Create `src/components/ui/button.tsx`:

```typescript
import { forwardRef, ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg"
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-blue-600 text-white hover:bg-blue-700": variant === "default",
            "border border-gray-300 bg-white hover:bg-gray-50": variant === "outline",
            "hover:bg-gray-100": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700": variant === "destructive",
          },
          {
            "h-10 px-4 py-2": size === "default",
            "h-8 px-3 text-sm": size === "sm",
            "h-12 px-6 text-lg": size === "lg",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
```

**Step 2: Create Input component**

Create `src/components/ui/input.tsx`:

```typescript
import { forwardRef, InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          className={cn(
            "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-red-500" : "border-gray-300",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
```

**Step 3: Create Card component**

Create `src/components/ui/card.tsx`:

```typescript
import { HTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/utils"

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-gray-200 bg-white shadow-sm",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardContent }
```

**Step 4: Create utils**

Create `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Install clsx:

```bash
npm install clsx tailwind-merge
```

**Step 5: Create Header component**

Create `src/components/layout/header.tsx`:

```typescript
import Link from "next/link"
import { auth } from "@/lib/auth"
import { logout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"

export async function Header() {
  const session = await auth()

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-blue-600">
          FiskAI
        </Link>

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

**Step 6: Create Sidebar component**

Create `src/components/layout/sidebar.tsx`:

```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Nadzorna ploča", href: "/dashboard", icon: "📊" },
  { name: "E-Računi", href: "/e-invoices", icon: "📄" },
  { name: "Kontakti", href: "/contacts", icon: "👥" },
  { name: "Proizvodi", href: "/products", icon: "📦" },
  { name: "Postavke", href: "/settings", icon: "⚙️" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r border-gray-200 bg-white">
      <nav className="flex flex-col gap-1 p-4">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <span>{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

**Step 7: Create auth layout**

Create `src/app/(auth)/layout.tsx`:

```typescript
import { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
```

**Step 8: Create dashboard layout**

Create `src/app/(dashboard)/layout.tsx`:

```typescript
import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  )
}
```

**Step 9: Commit**

Run:

```bash
git add -A
git commit -m "feat: add basic UI components and layouts"
```

---

## Task 12: Create Authentication Pages

**Files:**

- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`

**Step 1: Create login page**

Create `src/app/(auth)/login/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, LoginInput } from "@/lib/validations"
import { login } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginInput) {
    setLoading(true)
    setError(null)

    const result = await login(data)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Prijava u FiskAI</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="vas@email.com"
              error={errors.email?.message}
              {...register("email")}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Lozinka
            </label>
            <Input
              id="password"
              type="password"
              error={errors.password?.message}
              {...register("password")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Prijava..." : "Prijavi se"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Nemate račun?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Registrirajte se
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Create register page**

Create `src/app/(auth)/register/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { registerSchema, RegisterInput } from "@/lib/validations"
import { register as registerUser } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterInput) {
    setLoading(true)
    setError(null)

    const result = await registerUser(data)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.success) {
      router.push("/login?registered=true")
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Registracija</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Ime i prezime
            </label>
            <Input
              id="name"
              placeholder="Ivan Horvat"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="vas@email.com"
              error={errors.email?.message}
              {...register("email")}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Lozinka
            </label>
            <Input
              id="password"
              type="password"
              error={errors.password?.message}
              {...register("password")}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Potvrdite lozinku
            </label>
            <Input
              id="confirmPassword"
              type="password"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Registracija..." : "Registriraj se"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Već imate račun?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Prijavite se
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Commit**

Run:

```bash
git add -A
git commit -m "feat: add login and registration pages"
```

---

## Task 13: Create Dashboard and E-Invoice Pages

**Files:**

- Create: `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/app/(dashboard)/e-invoices/page.tsx`
- Create: `src/app/(dashboard)/e-invoices/new/page.tsx`
- Create: `src/app/(dashboard)/onboarding/page.tsx`

**Step 1: Create dashboard page**

Create `src/app/(dashboard)/dashboard/page.tsx`:

```typescript
import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default async function DashboardPage() {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
    redirect("/onboarding")
  }

  // Get counts
  const [eInvoiceCount, contactCount] = await Promise.all([
    db.eInvoice.count({ where: { companyId: company.id } }),
    db.contact.count({ where: { companyId: company.id } }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dobrodošli, {user.name || user.email}</h1>
        <p className="text-gray-600">{company.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">
              E-Računi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{eInvoiceCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">
              Kontakti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{contactCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">
              OIB
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-mono">{company.oib}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fiskalizacija 2.0 Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={company.isVatPayer ? "text-green-500" : "text-yellow-500"}>
                {company.isVatPayer ? "✓" : "○"}
              </span>
              <span>PDV obveznik: {company.isVatPayer ? "Da" : "Ne"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={company.eInvoiceProvider ? "text-green-500" : "text-red-500"}>
                {company.eInvoiceProvider ? "✓" : "✗"}
              </span>
              <span>
                Informacijski posrednik:{" "}
                {company.eInvoiceProvider || "Nije konfiguriran"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Create e-invoices list page**

Create `src/app/(dashboard)/e-invoices/page.tsx`:

```typescript
import Link from "next/link"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getEInvoices } from "@/app/actions/e-invoice"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default async function EInvoicesPage() {
  const user = await requireAuth()
  await requireCompany(user.id!)

  const eInvoices = await getEInvoices()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">E-Računi</h1>
        <Link href="/e-invoices/new">
          <Button>Novi E-Račun</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {eInvoices.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nemate još nijedan e-račun.{" "}
              <Link href="/e-invoices/new" className="text-blue-600 hover:underline">
                Kreirajte prvi
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Broj
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Kupac
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Datum
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                    Iznos
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {eInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/e-invoices/${invoice.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{invoice.buyer?.name || "-"}</td>
                    <td className="px-4 py-3">
                      {new Date(invoice.issueDate).toLocaleDateString("hr-HR")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {Number(invoice.totalAmount).toFixed(2)} {invoice.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          invoice.status === "SENT"
                            ? "bg-green-100 text-green-700"
                            : invoice.status === "DRAFT"
                              ? "bg-gray-100 text-gray-700"
                              : invoice.status === "ERROR"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Create new e-invoice page**

Create `src/app/(dashboard)/e-invoices/new/page.tsx`:

```typescript
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { eInvoiceSchema, EInvoiceInput } from "@/lib/validations"
import { createEInvoice, sendEInvoice } from "@/app/actions/e-invoice"
import { getContacts } from "@/app/actions/contact"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Contact } from "@prisma/client"

export default function NewEInvoicePage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EInvoiceInput>({
    resolver: zodResolver(eInvoiceSchema),
    defaultValues: {
      issueDate: new Date(),
      currency: "EUR",
      lines: [
        {
          description: "",
          quantity: 1,
          unit: "C62",
          unitPrice: 0,
          vatRate: 25,
          vatCategory: "S",
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  })

  useEffect(() => {
    getContacts("CUSTOMER").then(setContacts)
  }, [])

  const lines = watch("lines")
  const totals = lines.reduce(
    (acc, line) => {
      const net = (line.quantity || 0) * (line.unitPrice || 0)
      const vat = net * ((line.vatRate || 0) / 100)
      return {
        net: acc.net + net,
        vat: acc.vat + vat,
        total: acc.total + net + vat,
      }
    },
    { net: 0, vat: 0, total: 0 }
  )

  async function onSubmit(data: EInvoiceInput) {
    setLoading(true)
    setError(null)

    const result = await createEInvoice(data)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push("/e-invoices")
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Novi E-Račun</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Osnovni podaci</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Kupac</label>
              <select
                className="h-10 w-full rounded-md border border-gray-300 px-3"
                {...register("buyerId")}
              >
                <option value="">Odaberite kupca</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} {contact.oib && `(${contact.oib})`}
                  </option>
                ))}
              </select>
              {errors.buyerId && (
                <p className="text-sm text-red-500">{errors.buyerId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Broj računa</label>
              <Input
                {...register("invoiceNumber")}
                error={errors.invoiceNumber?.message}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Datum izdavanja</label>
              <Input
                type="date"
                {...register("issueDate")}
                error={errors.issueDate?.message}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Datum dospijeća</label>
              <Input type="date" {...register("dueDate")} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Referenca kupca</label>
              <Input {...register("buyerReference")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Stavke</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  description: "",
                  quantity: 1,
                  unit: "C62",
                  unitPrice: 0,
                  vatRate: 25,
                  vatCategory: "S",
                })
              }
            >
              Dodaj stavku
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-4 rounded-md border p-4 md:grid-cols-6"
              >
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Opis</label>
                  <Input {...register(`lines.${index}.description`)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Količina</label>
                  <Input
                    type="number"
                    step="0.001"
                    {...register(`lines.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Cijena</label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`lines.${index}.unitPrice`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">PDV %</label>
                  <Input
                    type="number"
                    {...register(`lines.${index}.vatRate`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="flex items-end">
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      Ukloni
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end space-y-1 text-right">
              <div className="space-y-1">
                <p className="text-sm text-gray-500">
                  Neto: {totals.net.toFixed(2)} EUR
                </p>
                <p className="text-sm text-gray-500">
                  PDV: {totals.vat.toFixed(2)} EUR
                </p>
                <p className="text-lg font-bold">
                  Ukupno: {totals.total.toFixed(2)} EUR
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Spremanje..." : "Spremi kao nacrt"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
```

**Step 4: Create onboarding page**

Create `src/app/(dashboard)/onboarding/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { companySchema, CompanyInput } from "@/lib/validations"
import { createCompany } from "@/app/actions/company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      country: "HR",
      isVatPayer: false,
    },
  })

  async function onSubmit(data: CompanyInput) {
    setLoading(true)
    setError(null)

    const result = await createCompany(data)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Dobrodošli u FiskAI</h1>
        <p className="text-gray-600">
          Postavite svoju tvrtku za početak korištenja
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Podaci o tvrtki</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Naziv tvrtke</label>
              <Input
                {...register("name")}
                error={errors.name?.message}
                placeholder="Moja Tvrtka d.o.o."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">OIB</label>
              <Input
                {...register("oib")}
                error={errors.oib?.message}
                placeholder="12345678901"
                maxLength={11}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Adresa</label>
              <Input
                {...register("address")}
                error={errors.address?.message}
                placeholder="Ilica 1"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Grad</label>
                <Input
                  {...register("city")}
                  error={errors.city?.message}
                  placeholder="Zagreb"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Poštanski broj</label>
                <Input
                  {...register("postalCode")}
                  error={errors.postalCode?.message}
                  placeholder="10000"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  {...register("email")}
                  placeholder="info@tvrtka.hr"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefon</label>
                <Input {...register("phone")} placeholder="+385 1 234 5678" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">IBAN</label>
              <Input
                {...register("iban")}
                placeholder="HR1234567890123456789"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isVatPayer"
                {...register("isVatPayer")}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="isVatPayer" className="text-sm">
                Obveznik PDV-a
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Spremanje..." : "Nastavi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 5: Update root page**

Update `src/app/page.tsx`:

```typescript
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function HomePage() {
  const session = await auth()

  if (session?.user) {
    redirect("/dashboard")
  }

  redirect("/login")
}
```

**Step 6: Commit**

Run:

```bash
git add -A
git commit -m "feat: add dashboard, e-invoices, and onboarding pages"
```

---

## Task 14: Final Setup and Test

**Step 1: Ensure database is running**

Run:

```bash
docker run -d --name fiskai-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fiskai -p 5432:5432 postgres:16-alpine
```

Or if using existing PostgreSQL, create database:

```bash
createdb fiskai
```

**Step 2: Run migrations**

Run:

```bash
npx prisma migrate deploy
```

**Step 3: Start development server**

Run:

```bash
npm run dev
```

**Step 4: Test the application**

1. Open http://localhost:3000
2. Register a new account
3. Log in
4. Complete onboarding (create company)
5. Create a contact
6. Create an e-invoice
7. Verify e-invoice appears in list

**Step 5: Final commit**

Run:

```bash
git add -A
git commit -m "feat: complete Phase 1 MVP - Core + E-Invoicing"
git push
```

---

## Summary

Phase 1 implements:

1. **Core Module**
   - User authentication (email/password)
   - Company management (multi-tenant)
   - Contact management (customers/suppliers)
   - Basic product catalog

2. **E-Invoicing Module**
   - Create e-invoice drafts
   - UBL 2.1 XML generation (PEPPOL BIS 3.0 compliant)
   - Provider-agnostic adapter pattern
   - Mock provider for development
   - Send/fiscalize flow (mock)

3. **UI**
   - Authentication pages (login/register)
   - Dashboard with stats
   - E-invoice list and creation form
   - Company onboarding

**Next Phase:**

- Integrate real e-invoice provider (IE Računi or DDD)
- Add contacts management UI
- Add products management UI
- Implement PDF generation
- Add e-invoice receiving (inbound)
