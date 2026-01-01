# Interfaces Layer

Entry points to the application: API routes, server actions, and controllers.

## Purpose

Contains all entry points where external actors (users, other systems) interact
with the application. This layer receives requests, validates input, invokes
use cases, and formats responses.

## Import Rules

- **CAN import:** Application layer (`src/application/*`), Domain layer (for DTOs)
- **CANNOT import:** Infrastructure directly (use dependency injection)
- **CAN use:** `next`, `react` (for server actions), HTTP utilities, validation libraries

## Structure

- `api/` - REST API endpoints (future migration from `src/app/api`)
- `actions/` - Next.js Server Actions (future migration from `src/app/**/actions.ts`)

## Principles

1. **Thin Controllers**: Minimal logic - validate, delegate to use case, format response
2. **Dependency Injection**: Wire up use cases with infrastructure at the entry point
3. **Input Validation**: Validate and sanitize all external input
4. **Error Handling**: Catch domain exceptions and translate to HTTP responses
5. **Authentication**: Verify user identity and permissions before invoking use cases

## Example

```typescript
// src/interfaces/actions/invoicing/createInvoiceAction.ts
"use server"

import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  CreateInvoiceUseCase,
  CreateInvoiceInput,
} from "@/application/invoicing/CreateInvoiceUseCase"
import { PrismaInvoiceRepository } from "@/infrastructure/persistence/PrismaInvoiceRepository"

// Input validation schema
const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPriceCents: z.number().int().positive(),
        vatRatePercent: z.number().min(0).max(100),
      })
    )
    .min(1),
})

export async function createInvoiceAction(formData: FormData) {
  // 1. Authenticate
  const session = await auth()
  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" }
  }

  // 2. Validate input
  const rawInput = {
    customerId: formData.get("customerId"),
    items: JSON.parse(formData.get("items") as string),
  }

  const validation = createInvoiceSchema.safeParse(rawInput)
  if (!validation.success) {
    return { success: false, error: validation.error.flatten() }
  }

  // 3. Wire up dependencies (Composition Root)
  const invoiceRepository = new PrismaInvoiceRepository(prisma)
  const useCase = new CreateInvoiceUseCase(invoiceRepository)

  // 4. Execute use case
  try {
    const input: CreateInvoiceInput = {
      tenantId: session.user.tenantId,
      customerId: validation.data.customerId,
      items: validation.data.items,
    }

    const result = await useCase.execute(input)

    return { success: true, data: result }
  } catch (error) {
    console.error("Failed to create invoice:", error)
    return { success: false, error: "Failed to create invoice" }
  }
}
```

```typescript
// src/interfaces/api/invoices/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateInvoiceUseCase } from "@/application/invoicing/CreateInvoiceUseCase"
import { PrismaInvoiceRepository } from "@/infrastructure/persistence/PrismaInvoiceRepository"

const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPriceCents: z.number().int().positive(),
        vatRatePercent: z.number().min(0).max(100),
      })
    )
    .min(1),
})

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse and validate input
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const validation = createInvoiceSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.flatten() },
      { status: 400 }
    )
  }

  // 3. Wire up dependencies
  const invoiceRepository = new PrismaInvoiceRepository(prisma)
  const useCase = new CreateInvoiceUseCase(invoiceRepository)

  // 4. Execute use case
  try {
    const result = await useCase.execute({
      tenantId: session.user.tenantId,
      customerId: validation.data.customerId,
      items: validation.data.items,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Failed to create invoice:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

## Dependency Injection

In production, consider using a DI container or factory pattern:

```typescript
// src/interfaces/di/container.ts
import { PrismaClient } from "@prisma/client"
import { CreateInvoiceUseCase } from "@/application/invoicing/CreateInvoiceUseCase"
import { PrismaInvoiceRepository } from "@/infrastructure/persistence/PrismaInvoiceRepository"
import { PoreznaClient } from "@/infrastructure/fiscal/PoreznaClient"

export function createContainer(prisma: PrismaClient) {
  const invoiceRepository = new PrismaInvoiceRepository(prisma)
  const fiscalService = new PoreznaClient(/* ... */)

  return {
    createInvoiceUseCase: new CreateInvoiceUseCase(invoiceRepository),
    // ... other use cases
  }
}
```

## Error Handling

Map domain exceptions to HTTP status codes:

```typescript
// src/interfaces/api/errorHandler.ts
import { NextResponse } from "next/server"

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message)
  }
}

export function handleError(error: unknown): NextResponse {
  if (error instanceof DomainError) {
    switch (error.code) {
      case "NOT_FOUND":
        return NextResponse.json({ error: error.message }, { status: 404 })
      case "VALIDATION":
        return NextResponse.json({ error: error.message }, { status: 400 })
      case "CONFLICT":
        return NextResponse.json({ error: error.message }, { status: 409 })
      default:
        return NextResponse.json({ error: error.message }, { status: 422 })
    }
  }

  console.error("Unhandled error:", error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
```

## Testing

Test server actions and API routes with integration tests:

```typescript
describe("POST /api/invoices", () => {
  it("creates an invoice and returns 201", async () => {
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: "cust-1",
        items: [{ description: "Widget", quantity: 1, unitPriceCents: 1000, vatRatePercent: 25 }],
      }),
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.invoiceId).toBeDefined()
  })
})
```
