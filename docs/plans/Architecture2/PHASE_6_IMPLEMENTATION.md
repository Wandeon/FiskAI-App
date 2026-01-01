# Phase 6: Validation Hardening - Implementation Plan

**Status:** READY FOR EXECUTION (after Phase 5)
**Depends On:** Phase 5 Completion
**Duration Estimate:** 2-3 focused sessions
**Goal:** Achieve 100% boundary validation

---

## 0. Phase 6 Objectives

1. Add Zod validation to every API route
2. Add Zod validation to every server action
3. Add Zod validation to every import handler
4. Remove all manual validation (`if (!x)`)
5. Standardize error responses
6. Create validation coverage metric

---

## 1. Current Validation State

Based on codebase analysis:

| Metric                       | Current | Target |
| ---------------------------- | ------- | ------ |
| API routes with Zod          | 55      | 237    |
| Coverage                     | 23%     | 100%   |
| Manual `if (!x)` validations | Unknown | 0      |

---

## 2. Validation Standards

### 2.1 Standard API Route Pattern

**Every API route MUST follow this pattern:**

```typescript
// src/app/api/example/route.ts
import { z } from "zod"
import { NextResponse } from "next/server"
import { validateRequest } from "@/lib/validation/validate-request"
import { ApiError, handleApiError } from "@/lib/api-error"

const RequestSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().int().positive(),
  // ... all fields validated
})

export async function POST(req: Request) {
  try {
    // 1. Validate at boundary
    const body = await validateRequest(req, RequestSchema)

    // 2. Call use case
    const result = await someUseCase.execute(body)

    // 3. Return response
    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
```

### 2.2 Standard Server Action Pattern

```typescript
// src/app/actions/example.ts
"use server"

import { z } from "zod"
import { validateAction } from "@/lib/validation/validate-action"

const InputSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
})

export async function exampleAction(input: unknown) {
  // 1. Validate at boundary
  const validated = validateAction(input, InputSchema)

  // 2. Execute business logic
  // ...
}
```

---

## 3. Create Validation Helpers

### 3.1 Create `src/lib/validation/validate-request.ts`

```typescript
// src/lib/validation/validate-request.ts
import { z } from "zod"
import { ApiError } from "@/lib/api-error"

export async function validateRequest<T extends z.ZodSchema>(
  req: Request,
  schema: T
): Promise<z.infer<T>> {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    throw new ApiError("INVALID_JSON", "Request body is not valid JSON", 400)
  }

  const result = schema.safeParse(body)

  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Request validation failed", 400, {
      errors: result.error.flatten().fieldErrors,
    })
  }

  return result.data
}

export function validateQuery<T extends z.ZodSchema>(url: URL, schema: T): z.infer<T> {
  const params = Object.fromEntries(url.searchParams)
  const result = schema.safeParse(params)

  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Query validation failed", 400, {
      errors: result.error.flatten().fieldErrors,
    })
  }

  return result.data
}
```

### 3.2 Create `src/lib/validation/validate-action.ts`

```typescript
// src/lib/validation/validate-action.ts
import { z } from "zod"

export function validateAction<T extends z.ZodSchema>(input: unknown, schema: T): z.infer<T> {
  const result = schema.safeParse(input)

  if (!result.success) {
    throw new ValidationError("Action validation failed", result.error.flatten().fieldErrors)
  }

  return result.data
}

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR"

  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[]>
  ) {
    super(message)
    this.name = "ValidationError"
  }
}
```

---

## 4. Standard Error Response Format

### 4.1 Update `src/lib/api-error.ts`

```typescript
// src/lib/api-error.ts
import { NextResponse } from "next/server"
import { ZodError } from "zod"

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function handleApiError(error: unknown): NextResponse {
  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        errors: error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  // Known API errors
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
      { status: error.status }
    )
  }

  // Domain errors
  if (error instanceof Error && "code" in error) {
    return NextResponse.json(
      {
        code: (error as any).code,
        message: error.message,
      },
      { status: 400 }
    )
  }

  // Unknown errors
  console.error("Unhandled error:", error)
  return NextResponse.json(
    {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
    { status: 500 }
  )
}
```

---

## 5. Common Zod Schemas

### 5.1 Create `src/lib/validation/common-schemas.ts`

```typescript
// src/lib/validation/common-schemas.ts
import { z } from "zod"

// Croatian OIB (11 digits)
export const oibSchema = z.string().regex(/^\d{11}$/, "OIB must be 11 digits")

// Croatian IBAN
export const ibanSchema = z.string().regex(/^HR\d{19}$/, "Invalid Croatian IBAN format")

// Money in cents (always integer)
export const moneyCentsSchema = z.number().int()

// Positive money amount
export const positiveMoneyCentsSchema = z.number().int().positive()

// UUID
export const uuidSchema = z.string().uuid()

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Date range
export const dateRangeSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((data) => data.from <= data.to, "From date must be before or equal to To date")

// Invoice number (Croatian format)
export const invoiceNumberSchema = z
  .string()
  .regex(/^\d+-\d+-\d+$/, "Invoice number must be in format: broj-prostor-uređaj")
```

---

## 6. Routes Requiring Validation (Priority)

### 6.1 High Priority (Financial/Regulated)

| Route                      | Current | Action                  |
| -------------------------- | ------- | ----------------------- |
| `POST /api/invoices`       | No Zod  | Add InvoiceCreateSchema |
| `POST /api/fiscal/submit`  | No Zod  | Add FiscalSubmitSchema  |
| `POST /api/banking/import` | No Zod  | Add BankImportSchema    |
| `POST /api/expenses`       | Partial | Complete ExpenseSchema  |
| `POST /api/vat/return`     | No Zod  | Add VatReturnSchema     |

### 6.2 Medium Priority (User Data)

| Route                 | Action              |
| --------------------- | ------------------- |
| `POST /api/contacts`  | Add ContactSchema   |
| `POST /api/products`  | Add ProductSchema   |
| `PUT /api/settings/*` | Add SettingsSchemas |

### 6.3 Low Priority (Admin/Internal)

All remaining routes.

---

## 7. Validation Coverage Script

### 7.1 Create `scripts/check-validation-coverage.ts`

```typescript
// scripts/check-validation-coverage.ts
import { glob } from "glob"
import fs from "fs"

async function checkCoverage() {
  const routes = await glob("src/app/api/**/route.ts")
  const actions = await glob("src/app/actions/*.ts")

  let withZod = 0
  let withoutZod = 0
  const missing: string[] = []

  for (const file of [...routes, ...actions]) {
    const content = fs.readFileSync(file, "utf8")

    if (content.includes("z.object") || content.includes("z.array")) {
      withZod++
    } else {
      withoutZod++
      missing.push(file)
    }
  }

  const total = withZod + withoutZod
  const coverage = ((withZod / total) * 100).toFixed(1)

  console.log(`\nValidation Coverage: ${coverage}%`)
  console.log(`With Zod: ${withZod}`)
  console.log(`Without Zod: ${withoutZod}`)

  if (missing.length > 0) {
    console.log(`\nMissing validation:`)
    missing.forEach((f) => console.log(`  - ${f}`))
  }

  // Exit with error if coverage < 100%
  if (withoutZod > 0) {
    process.exit(1)
  }
}

checkCoverage()
```

---

## 8. Exit Criteria

Phase 6 is complete when:

- [ ] 100% of API routes have Zod validation
- [ ] 100% of server actions have Zod validation
- [ ] 0 manual `if (!x)` validations remain
- [ ] Standard error response format implemented
- [ ] Validation coverage script passes in CI
- [ ] Common schemas created and reused

---

**Next Document:** Phase 7 Implementation Plan (Testing Expansion)
