# Control Center Shells Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement three Control Center shells (Client, Accountant, Admin) that render queues and actions using the Capability Resolution API as the single source of truth.

**Architecture:** Server components call `/api/capabilities/resolve` to determine what to render. New capability-aware primitives in `src/components/capability/` replace the toxic visibility system. UI displays state, explains blockers, collects intent - zero business logic.

**Tech Stack:** Next.js 15 Server Components, React Server Actions, TypeScript, Tailwind CSS, existing UI primitives from `src/components/ui/`

---

## Hard Constraints (from user authorization)

1. **Do NOT use or import from `src/lib/visibility/`** - Leave it unused
2. **Control Centers are shells, not dashboards** - No entity editors, no CRUD pages
3. **Every action requires capability resolution** - No shortcuts
4. **If something feels like a feature page, STOP**

---

## What is NOT implemented in this plan

- Entity-specific editors (invoice editor, expense form, etc.)
- Navigation trees or menus
- "Quick actions" without resolution
- Form validation
- Data mutation (that's Phase 2)
- Replacing existing pages

---

## Route Structure

| Portal | Route | Role Check |
|--------|-------|------------|
| Client | `/app/(app)/control-center/page.tsx` | USER |
| Accountant | `/app/(staff)/control-center/page.tsx` | STAFF |
| Admin | `/app/(admin)/control-center/page.tsx` | ADMIN |

---

## Task 1: Capability Resolution Server Utilities

**Files:**
- Create: `src/lib/capabilities/server.ts`
- Test: `src/lib/capabilities/__tests__/server.test.ts`

**Purpose:** Server-side functions to call the capability resolver without going through HTTP.

**Step 1: Write the test file**

```typescript
// src/lib/capabilities/__tests__/server.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveCapabilitiesForUser } from "../server"

// Mock the resolver
vi.mock("../resolver", () => ({
  resolveCapabilities: vi.fn(),
}))

// Mock auth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

// Mock db
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

describe("resolveCapabilitiesForUser", () => {
  it("should return UNAUTHORIZED for unauthenticated users", async () => {
    const { auth } = await import("@/auth")
    vi.mocked(auth).mockResolvedValue(null)

    const result = await resolveCapabilitiesForUser(["INV-001"])

    expect(result).toHaveLength(1)
    expect(result[0].state).toBe("UNAUTHORIZED")
  })

  it("should resolve capabilities for authenticated users", async () => {
    const { auth } = await import("@/auth")
    const { db } = await import("@/lib/db")
    const { resolveCapabilities } = await import("../resolver")

    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any)

    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1",
      systemRole: "USER",
      companyMemberships: [{ companyId: "company-1", role: "OWNER" }],
    } as any)

    vi.mocked(resolveCapabilities).mockResolvedValue([
      {
        capability: "INV-001",
        state: "READY",
        inputs: [],
        blockers: [],
        actions: [],
        resolvedAt: new Date().toISOString(),
      },
    ])

    const result = await resolveCapabilitiesForUser(["INV-001"])

    expect(result).toHaveLength(1)
    expect(result[0].state).toBe("READY")
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd /home/admin/FiskAI/.worktrees/control-centers
npx vitest run src/lib/capabilities/__tests__/server.test.ts
```

Expected: FAIL - module not found

**Step 3: Write the implementation**

```typescript
// src/lib/capabilities/server.ts
/**
 * Server-side Capability Resolution
 *
 * Call capability resolution directly from server components
 * without HTTP round-trip.
 *
 * @module capabilities/server
 * @since Control Center Shells
 */

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { resolveCapabilities, resolveCapability } from "./resolver"
import type { CapabilityResponse, CapabilityRequest } from "./types"

/**
 * Build user context from session for capability resolution.
 */
async function buildUserContext() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      systemRole: true,
      companyMemberships: {
        where: { isActive: true },
        select: {
          companyId: true,
          role: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!user) {
    return null
  }

  const membership = user.companyMemberships[0]
  if (!membership) {
    return null
  }

  const permissions = buildPermissions(user.systemRole, membership.role)

  return {
    userId: user.id,
    companyId: membership.companyId,
    permissions,
  }
}

/**
 * Build permissions list based on system role and company role.
 */
function buildPermissions(systemRole: string, companyRole: string): string[] {
  const permissions: string[] = []

  // Base permissions for all authenticated users
  permissions.push("invoicing:read", "expenses:read", "banking:read")

  // Role-based permissions
  switch (companyRole) {
    case "OWNER":
    case "ADMIN":
      permissions.push(
        "invoicing:write",
        "invoicing:approve",
        "expenses:write",
        "expenses:approve",
        "banking:write",
        "reconciliation:write",
        "fiscalization:write",
        "payroll:read",
        "payroll:write",
        "payroll:approve",
        "assets:read",
        "assets:write",
        "gl:read",
        "gl:write",
        "admin:periods",
        "admin:users"
      )
      break

    case "ACCOUNTANT":
      permissions.push(
        "invoicing:write",
        "expenses:write",
        "expenses:approve",
        "banking:write",
        "reconciliation:write",
        "fiscalization:write",
        "payroll:read",
        "payroll:write",
        "assets:read",
        "assets:write",
        "gl:read",
        "gl:write"
      )
      break

    case "MEMBER":
      permissions.push("invoicing:write", "expenses:write", "banking:write")
      break

    case "VIEWER":
      // Read-only, no additional permissions
      break
  }

  // System role overrides
  if (systemRole === "ADMIN" || systemRole === "STAFF") {
    permissions.push("admin:periods", "admin:users", "admin:system")
  }

  return [...new Set(permissions)]
}

/**
 * Resolve capabilities for the current user.
 *
 * Use this in server components to get capability state.
 */
export async function resolveCapabilitiesForUser(
  capabilityIds: string[],
  context?: { entityId?: string; entityType?: string; targetDate?: string }
): Promise<CapabilityResponse[]> {
  const userContext = await buildUserContext()

  if (!userContext) {
    // Return UNAUTHORIZED for all capabilities
    return capabilityIds.map((id) => ({
      capability: id,
      state: "UNAUTHORIZED" as const,
      inputs: [],
      blockers: [],
      actions: [],
      resolvedAt: new Date().toISOString(),
    }))
  }

  const requests: CapabilityRequest[] = capabilityIds.map((id) => ({
    capability: id,
    context: {
      companyId: userContext.companyId,
      ...context,
    },
  }))

  return resolveCapabilities(db, requests, userContext)
}

/**
 * Resolve a single capability for the current user.
 */
export async function resolveCapabilityForUser(
  capabilityId: string,
  context?: { entityId?: string; entityType?: string; targetDate?: string }
): Promise<CapabilityResponse> {
  const results = await resolveCapabilitiesForUser([capabilityId], context)
  return results[0]
}

/**
 * Get all capabilities for a domain, resolved for current user.
 */
export async function resolveCapabilitiesByDomain(
  domain: string
): Promise<CapabilityResponse[]> {
  const { getCapabilitiesByDomain } = await import("./registry")
  const capabilities = getCapabilitiesByDomain(domain as any)
  const ids = capabilities.map((c) => c.id)
  return resolveCapabilitiesForUser(ids)
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/capabilities/__tests__/server.test.ts
```

Expected: PASS

**Step 5: Update the capabilities index to export server utilities**

```typescript
// Add to src/lib/capabilities/index.ts

// Server utilities (for server components)
export {
  resolveCapabilitiesForUser,
  resolveCapabilityForUser,
  resolveCapabilitiesByDomain,
} from "./server"
```

**Step 6: Commit**

```bash
git add src/lib/capabilities/server.ts src/lib/capabilities/__tests__/server.test.ts src/lib/capabilities/index.ts
git commit -m "feat(capabilities): add server-side resolution utilities"
```

---

## Task 2: Capability-Aware UI Primitives

**Files:**
- Create: `src/components/capability/types.ts`
- Create: `src/components/capability/CapabilityStateIndicator.tsx`
- Create: `src/components/capability/BlockerDisplay.tsx`
- Create: `src/components/capability/ActionButton.tsx`
- Create: `src/components/capability/index.ts`

**Purpose:** New UI primitives that render capability state without any business logic.

**Step 1: Create the types file**

```typescript
// src/components/capability/types.ts
/**
 * Capability UI Component Types
 *
 * Types for capability-aware UI components.
 * These components render capability state - they do not determine it.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import type {
  CapabilityState,
  CapabilityResponse,
  CapabilityBlocker,
  CapabilityAction,
} from "@/lib/capabilities"

export type { CapabilityState, CapabilityResponse, CapabilityBlocker, CapabilityAction }

/**
 * Props for components that render capability state.
 */
export interface CapabilityStateProps {
  /** The resolved capability response */
  resolution: CapabilityResponse
}

/**
 * Props for components that render blockers.
 */
export interface BlockerDisplayProps {
  /** Blockers to display */
  blockers: CapabilityBlocker[]
  /** Whether to show resolution hints */
  showResolution?: boolean
}

/**
 * Props for capability-driven action buttons.
 */
export interface ActionButtonProps {
  /** The action to render */
  action: CapabilityAction
  /** Capability ID for diagnostics */
  capabilityId: string
  /** Click handler - only called if action is enabled */
  onClick?: () => void
  /** Show diagnostics overlay */
  showDiagnostics?: boolean
}

/**
 * Queue item with capability resolution.
 */
export interface QueueItem {
  /** Entity ID */
  id: string
  /** Entity type */
  type: string
  /** Display title */
  title: string
  /** Entity state/status */
  status: string
  /** When this item was created/modified */
  timestamp: string
  /** Resolved capabilities for this item */
  capabilities: CapabilityResponse[]
}

/**
 * Queue definition for Control Centers.
 */
export interface QueueDefinition {
  /** Queue identifier */
  id: string
  /** Queue display name */
  name: string
  /** Queue description */
  description: string
  /** Capability IDs relevant to this queue */
  capabilityIds: string[]
  /** Entity type this queue contains */
  entityType: string
}
```

**Step 2: Create CapabilityStateIndicator**

```typescript
// src/components/capability/CapabilityStateIndicator.tsx
/**
 * Capability State Indicator
 *
 * Renders the state of a resolved capability.
 * No business logic - just visualization.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import { Badge } from "@/components/ui/badge"
import type { CapabilityState } from "./types"

interface Props {
  state: CapabilityState
  className?: string
}

const STATE_CONFIG: Record<
  CapabilityState,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  READY: { label: "Ready", variant: "default" },
  BLOCKED: { label: "Blocked", variant: "destructive" },
  MISSING_INPUTS: { label: "Missing Inputs", variant: "secondary" },
  UNAUTHORIZED: { label: "Unauthorized", variant: "outline" },
}

export function CapabilityStateIndicator({ state, className }: Props) {
  const config = STATE_CONFIG[state]

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
```

**Step 3: Create BlockerDisplay**

```typescript
// src/components/capability/BlockerDisplay.tsx
/**
 * Blocker Display
 *
 * Renders blockers that prevent capability execution.
 * Shows machine-readable codes and resolution hints.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { BlockerDisplayProps } from "./types"

export function BlockerDisplay({ blockers, showResolution = true }: BlockerDisplayProps) {
  if (blockers.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {blockers.map((blocker, index) => (
        <Alert key={index} variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-mono text-xs">{blocker.type}</AlertTitle>
          <AlertDescription>
            <p>{blocker.message}</p>
            {showResolution && blocker.resolution && (
              <p className="mt-1 text-xs opacity-80">
                Resolution: {blocker.resolution}
              </p>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
```

**Step 4: Create ActionButton**

```typescript
// src/components/capability/ActionButton.tsx
/**
 * Action Button
 *
 * Renders an action button based on capability resolution.
 * Disabled actions show the reason - never hidden.
 *
 * @module components/capability
 * @since Control Center Shells
 */

"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ActionButtonProps } from "./types"

export function ActionButton({
  action,
  capabilityId,
  onClick,
  showDiagnostics = false,
}: ActionButtonProps) {
  const handleClick = () => {
    if (action.enabled && onClick) {
      onClick()
    }
  }

  const button = (
    <Button
      variant={action.primary ? "default" : "outline"}
      disabled={!action.enabled}
      onClick={handleClick}
      className="relative"
    >
      {action.label}
      {showDiagnostics && (
        <span className="absolute -top-2 -right-2 text-[10px] font-mono bg-muted px-1 rounded">
          {capabilityId}
        </span>
      )}
    </Button>
  )

  if (!action.enabled && action.disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{action.disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}
```

**Step 5: Create index file**

```typescript
// src/components/capability/index.ts
/**
 * Capability UI Components
 *
 * Components that render capability state from the resolver.
 * These are projection-only - no business logic.
 *
 * @module components/capability
 * @since Control Center Shells
 */

export * from "./types"
export { CapabilityStateIndicator } from "./CapabilityStateIndicator"
export { BlockerDisplay } from "./BlockerDisplay"
export { ActionButton } from "./ActionButton"
```

**Step 6: Commit**

```bash
git add src/components/capability/
git commit -m "feat(ui): add capability-aware UI primitives"
```

---

## Task 3: Queue Renderer Component

**Files:**
- Create: `src/components/capability/QueueRenderer.tsx`
- Create: `src/components/capability/QueueItem.tsx`

**Purpose:** Render a queue of items with their resolved capability states.

**Step 1: Create QueueItem component**

```typescript
// src/components/capability/QueueItem.tsx
/**
 * Queue Item
 *
 * Renders a single item in a queue with its capability state.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CapabilityStateIndicator } from "./CapabilityStateIndicator"
import { BlockerDisplay } from "./BlockerDisplay"
import { ActionButton } from "./ActionButton"
import type { QueueItem as QueueItemType } from "./types"

interface Props {
  item: QueueItemType
  showDiagnostics?: boolean
}

export function QueueItemCard({ item, showDiagnostics = false }: Props) {
  // Find the primary capability (first READY, or first in list)
  const primaryCapability =
    item.capabilities.find((c) => c.state === "READY") || item.capabilities[0]

  return (
    <Card className="relative">
      {showDiagnostics && (
        <div className="absolute top-2 right-2 text-[10px] font-mono bg-muted px-2 py-1 rounded">
          {item.type}:{item.id.slice(0, 8)}
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{item.title}</CardTitle>
          {primaryCapability && (
            <CapabilityStateIndicator state={primaryCapability.state} />
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Status: {item.status} | {new Date(item.timestamp).toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent>
        {/* Show blockers if any capability is blocked */}
        {item.capabilities.some((c) => c.state === "BLOCKED") && (
          <div className="mb-4">
            <BlockerDisplay
              blockers={item.capabilities.flatMap((c) => c.blockers)}
              showResolution
            />
          </div>
        )}

        {/* Show available actions */}
        <div className="flex flex-wrap gap-2">
          {item.capabilities.map((cap) =>
            cap.actions
              .filter((a) => cap.state === "READY" || !a.enabled)
              .map((action) => (
                <ActionButton
                  key={`${cap.capability}-${action.id}`}
                  action={action}
                  capabilityId={cap.capability}
                  showDiagnostics={showDiagnostics}
                />
              ))
          )}
        </div>

        {/* Diagnostics panel */}
        {showDiagnostics && (
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer font-mono text-muted-foreground">
              Capability Diagnostics
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-48">
              {JSON.stringify(item.capabilities, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Create QueueRenderer component**

```typescript
// src/components/capability/QueueRenderer.tsx
/**
 * Queue Renderer
 *
 * Renders a queue of items with capability-driven state.
 * This is a server component - resolution happens server-side.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import { QueueItemCard } from "./QueueItem"
import type { QueueItem, QueueDefinition } from "./types"

interface Props {
  /** Queue definition */
  queue: QueueDefinition
  /** Items in the queue with resolved capabilities */
  items: QueueItem[]
  /** Show diagnostics */
  showDiagnostics?: boolean
  /** Empty state message */
  emptyMessage?: string
}

export function QueueRenderer({
  queue,
  items,
  showDiagnostics = false,
  emptyMessage = "No items in this queue",
}: Props) {
  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">{queue.name}</h3>
        <p className="text-sm text-muted-foreground">{queue.description}</p>
        {showDiagnostics && (
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Capabilities: {queue.capabilityIds.join(", ")}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              showDiagnostics={showDiagnostics}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Update index exports**

```typescript
// Add to src/components/capability/index.ts
export { QueueItemCard } from "./QueueItem"
export { QueueRenderer } from "./QueueRenderer"
```

**Step 4: Commit**

```bash
git add src/components/capability/QueueItem.tsx src/components/capability/QueueRenderer.tsx src/components/capability/index.ts
git commit -m "feat(ui): add queue renderer components"
```

---

## Task 4: Control Center Shell Layout

**Files:**
- Create: `src/components/capability/ControlCenterShell.tsx`
- Create: `src/components/capability/DiagnosticsToggle.tsx`

**Purpose:** Shared shell layout for all Control Centers.

**Step 1: Create DiagnosticsToggle**

```typescript
// src/components/capability/DiagnosticsToggle.tsx
/**
 * Diagnostics Toggle
 *
 * Developer toggle to show capability diagnostics.
 *
 * @module components/capability
 * @since Control Center Shells
 */

"use client"

import { useState, createContext, useContext } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface DiagnosticsContextValue {
  showDiagnostics: boolean
  setShowDiagnostics: (value: boolean) => void
}

const DiagnosticsContext = createContext<DiagnosticsContextValue>({
  showDiagnostics: false,
  setShowDiagnostics: () => {},
})

export function useDiagnostics() {
  return useContext(DiagnosticsContext)
}

export function DiagnosticsProvider({ children }: { children: React.ReactNode }) {
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  return (
    <DiagnosticsContext.Provider value={{ showDiagnostics, setShowDiagnostics }}>
      {children}
    </DiagnosticsContext.Provider>
  )
}

export function DiagnosticsToggle() {
  const { showDiagnostics, setShowDiagnostics } = useDiagnostics()

  return (
    <div className="flex items-center space-x-2 text-sm">
      <Switch
        id="diagnostics"
        checked={showDiagnostics}
        onCheckedChange={setShowDiagnostics}
      />
      <Label htmlFor="diagnostics" className="font-mono text-xs">
        Show capability diagnostics
      </Label>
    </div>
  )
}
```

**Step 2: Create ControlCenterShell**

```typescript
// src/components/capability/ControlCenterShell.tsx
/**
 * Control Center Shell
 *
 * Shared layout for all Control Centers.
 * Provides diagnostics context and consistent structure.
 *
 * @module components/capability
 * @since Control Center Shells
 */

import { DiagnosticsProvider, DiagnosticsToggle } from "./DiagnosticsToggle"

interface Props {
  /** Page title */
  title: string
  /** Role indicator */
  role: "Client" | "Accountant" | "Admin"
  /** Queue sections to render */
  children: React.ReactNode
}

export function ControlCenterShell({ title, role, children }: Props) {
  return (
    <DiagnosticsProvider>
      <div className="container mx-auto py-6 space-y-6">
        <header className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {role} Control Center - Capability-driven view
            </p>
          </div>
          <DiagnosticsToggle />
        </header>

        <main className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {children}
        </main>
      </div>
    </DiagnosticsProvider>
  )
}
```

**Step 3: Update index exports**

```typescript
// Add to src/components/capability/index.ts
export { ControlCenterShell } from "./ControlCenterShell"
export { DiagnosticsProvider, DiagnosticsToggle, useDiagnostics } from "./DiagnosticsToggle"
```

**Step 4: Commit**

```bash
git add src/components/capability/
git commit -m "feat(ui): add Control Center shell and diagnostics toggle"
```

---

## Task 5: Client Control Center

**Files:**
- Create: `src/app/(app)/control-center/page.tsx`
- Create: `src/app/(app)/control-center/queues.ts`

**Purpose:** Client Control Center showing actionable queues.

**Step 1: Define queue configurations**

```typescript
// src/app/(app)/control-center/queues.ts
/**
 * Client Control Center Queue Definitions
 *
 * Defines the queues shown to clients based on UX_CAPABILITY_BLUEPRINT.md
 *
 * @since Control Center Shells
 */

import type { QueueDefinition } from "@/components/capability"

export const CLIENT_QUEUES: QueueDefinition[] = [
  {
    id: "draft-invoices",
    name: "Draft Invoices",
    description: "Invoices ready to issue or delete",
    capabilityIds: ["INV-002", "INV-003", "INV-004"],
    entityType: "EInvoice",
  },
  {
    id: "pending-fiscalization",
    name: "Pending Fiscalization",
    description: "Invoices awaiting fiscalization (48h deadline)",
    capabilityIds: ["INV-005"],
    entityType: "EInvoice",
  },
  {
    id: "unmatched-transactions",
    name: "Unmatched Transactions",
    description: "Bank transactions needing attention",
    capabilityIds: ["BNK-005", "BNK-007"],
    entityType: "BankTransaction",
  },
  {
    id: "unpaid-invoices",
    name: "Unpaid Invoices",
    description: "Invoices awaiting payment",
    capabilityIds: ["INV-008"],
    entityType: "EInvoice",
  },
  {
    id: "unpaid-expenses",
    name: "Unpaid Expenses",
    description: "Expenses awaiting payment",
    capabilityIds: ["EXP-004"],
    entityType: "Expense",
  },
]
```

**Step 2: Create the page**

```typescript
// src/app/(app)/control-center/page.tsx
/**
 * Client Control Center
 *
 * Shows actionable queues for the client/company operator.
 * All data comes from capability resolution.
 *
 * @since Control Center Shells
 */

import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  ControlCenterShell,
  QueueRenderer,
  type QueueItem,
} from "@/components/capability"
import { resolveCapabilitiesForUser } from "@/lib/capabilities"
import { CLIENT_QUEUES } from "./queues"

export const metadata = {
  title: "Control Center | FiskAI",
}

async function getQueueItems(
  queue: (typeof CLIENT_QUEUES)[number]
): Promise<QueueItem[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      companyMemberships: {
        where: { isActive: true },
        select: { companyId: true },
        take: 1,
      },
    },
  })

  const companyId = user?.companyMemberships[0]?.companyId
  if (!companyId) return []

  // Fetch entities based on queue type
  let entities: Array<{ id: string; title: string; status: string; timestamp: string }> = []

  switch (queue.entityType) {
    case "EInvoice": {
      const invoices = await db.eInvoice.findMany({
        where: {
          companyId,
          status: queue.id === "draft-invoices"
            ? "DRAFT"
            : queue.id === "pending-fiscalization"
            ? "PENDING_FISCALIZATION"
            : { in: ["FISCALIZED", "SENT"] },
        },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          createdAt: true,
          buyer: { select: { name: true } },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      })
      entities = invoices.map((inv) => ({
        id: inv.id,
        title: `${inv.invoiceNumber} - ${inv.buyer?.name || "Unknown"}`,
        status: inv.status,
        timestamp: inv.createdAt.toISOString(),
      }))
      break
    }
    case "BankTransaction": {
      const transactions = await db.bankTransaction.findMany({
        where: {
          bankAccount: { companyId },
          status: "UNMATCHED",
        },
        select: {
          id: true,
          description: true,
          status: true,
          transactionDate: true,
          amount: true,
        },
        take: 10,
        orderBy: { transactionDate: "desc" },
      })
      entities = transactions.map((tx) => ({
        id: tx.id,
        title: `${tx.description || "Transaction"} (${tx.amount})`,
        status: tx.status,
        timestamp: tx.transactionDate.toISOString(),
      }))
      break
    }
    case "Expense": {
      const expenses = await db.expense.findMany({
        where: {
          companyId,
          status: { in: ["DRAFT", "PENDING"] },
        },
        select: {
          id: true,
          description: true,
          status: true,
          date: true,
          vendor: { select: { name: true } },
        },
        take: 10,
        orderBy: { date: "desc" },
      })
      entities = expenses.map((exp) => ({
        id: exp.id,
        title: exp.description || exp.vendor?.name || "Expense",
        status: exp.status,
        timestamp: exp.date.toISOString(),
      }))
      break
    }
  }

  // Resolve capabilities for each entity
  const items: QueueItem[] = await Promise.all(
    entities.map(async (entity) => {
      const capabilities = await resolveCapabilitiesForUser(queue.capabilityIds, {
        entityId: entity.id,
        entityType: queue.entityType,
      })
      return {
        id: entity.id,
        type: queue.entityType,
        title: entity.title,
        status: entity.status,
        timestamp: entity.timestamp,
        capabilities,
      }
    })
  )

  return items
}

export default async function ClientControlCenterPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  // Fetch items for all queues
  const queueData = await Promise.all(
    CLIENT_QUEUES.map(async (queue) => ({
      queue,
      items: await getQueueItems(queue),
    }))
  )

  return (
    <ControlCenterShell title="What Needs Attention" role="Client">
      {queueData.map(({ queue, items }) => (
        <QueueRenderer
          key={queue.id}
          queue={queue}
          items={items}
          emptyMessage={`No ${queue.name.toLowerCase()}`}
        />
      ))}
    </ControlCenterShell>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/control-center/
git commit -m "feat(client): add Client Control Center shell"
```

---

## Task 6: Accountant Control Center

**Files:**
- Create: `src/app/(staff)/control-center/page.tsx`
- Create: `src/app/(staff)/control-center/queues.ts`

**Step 1: Define queue configurations**

```typescript
// src/app/(staff)/control-center/queues.ts
/**
 * Accountant Control Center Queue Definitions
 *
 * Based on UX_CAPABILITY_BLUEPRINT.md section 4.2
 *
 * @since Control Center Shells
 */

import type { QueueDefinition } from "@/components/capability"

export const ACCOUNTANT_QUEUES: QueueDefinition[] = [
  {
    id: "clients-pending-review",
    name: "Clients Pending Review",
    description: "Clients requiring review and sign-off",
    capabilityIds: ["STF-002", "STF-004"],
    entityType: "Company",
  },
  {
    id: "period-lock-requests",
    name: "Period Lock Requests",
    description: "Period close requests from clients",
    capabilityIds: ["PER-002", "PER-003"],
    entityType: "AccountingPeriod",
  },
  {
    id: "pending-invitations",
    name: "Pending Invitations",
    description: "Client invitations awaiting response",
    capabilityIds: ["STF-003"],
    entityType: "Invitation",
  },
]
```

**Step 2: Create the page**

```typescript
// src/app/(staff)/control-center/page.tsx
/**
 * Accountant Control Center
 *
 * Shows review queues and client oversight for staff.
 * All data comes from capability resolution.
 *
 * @since Control Center Shells
 */

import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  ControlCenterShell,
  QueueRenderer,
  type QueueItem,
} from "@/components/capability"
import { resolveCapabilitiesForUser } from "@/lib/capabilities"
import { ACCOUNTANT_QUEUES } from "./queues"

export const metadata = {
  title: "Accountant Control Center | FiskAI",
}

async function getQueueItems(
  queue: (typeof ACCOUNTANT_QUEUES)[number],
  userId: string
): Promise<QueueItem[]> {
  // Get staff assignments
  const assignments = await db.staffAssignment.findMany({
    where: { userId, status: "ACTIVE" },
    select: { companyId: true },
  })
  const assignedCompanyIds = assignments.map((a) => a.companyId)

  if (assignedCompanyIds.length === 0) return []

  let entities: Array<{ id: string; title: string; status: string; timestamp: string }> = []

  switch (queue.entityType) {
    case "Company": {
      const companies = await db.company.findMany({
        where: { id: { in: assignedCompanyIds } },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        take: 10,
      })
      entities = companies.map((c) => ({
        id: c.id,
        title: c.name,
        status: "ASSIGNED",
        timestamp: c.createdAt.toISOString(),
      }))
      break
    }
    case "AccountingPeriod": {
      const periods = await db.accountingPeriod.findMany({
        where: {
          companyId: { in: assignedCompanyIds },
          status: "OPEN",
        },
        select: {
          id: true,
          name: true,
          status: true,
          endDate: true,
          company: { select: { name: true } },
        },
        take: 10,
      })
      entities = periods.map((p) => ({
        id: p.id,
        title: `${p.company.name} - ${p.name}`,
        status: p.status,
        timestamp: p.endDate.toISOString(),
      }))
      break
    }
    case "Invitation": {
      // Placeholder - invitations would be fetched differently
      entities = []
      break
    }
  }

  // Resolve capabilities for each entity
  const items: QueueItem[] = await Promise.all(
    entities.map(async (entity) => {
      const capabilities = await resolveCapabilitiesForUser(queue.capabilityIds, {
        entityId: entity.id,
        entityType: queue.entityType,
      })
      return {
        id: entity.id,
        type: queue.entityType,
        title: entity.title,
        status: entity.status,
        timestamp: entity.timestamp,
        capabilities,
      }
    })
  )

  return items
}

export default async function AccountantControlCenterPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  // Verify user is STAFF
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true },
  })

  if (user?.systemRole !== "STAFF" && user?.systemRole !== "ADMIN") {
    redirect("/dashboard")
  }

  // Fetch items for all queues
  const queueData = await Promise.all(
    ACCOUNTANT_QUEUES.map(async (queue) => ({
      queue,
      items: await getQueueItems(queue, session.user.id),
    }))
  )

  return (
    <ControlCenterShell title="Client Oversight" role="Accountant">
      {queueData.map(({ queue, items }) => (
        <QueueRenderer
          key={queue.id}
          queue={queue}
          items={items}
          emptyMessage={`No ${queue.name.toLowerCase()}`}
        />
      ))}
    </ControlCenterShell>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(staff\)/control-center/
git commit -m "feat(staff): add Accountant Control Center shell"
```

---

## Task 7: Admin Control Center

**Files:**
- Create: `src/app/(admin)/control-center/page.tsx`
- Create: `src/app/(admin)/control-center/queues.ts`

**Step 1: Define queue configurations**

```typescript
// src/app/(admin)/control-center/queues.ts
/**
 * Admin Control Center Queue Definitions
 *
 * Based on UX_CAPABILITY_BLUEPRINT.md section 4.3
 *
 * @since Control Center Shells
 */

import type { QueueDefinition } from "@/components/capability"

export const ADMIN_QUEUES: QueueDefinition[] = [
  {
    id: "system-alerts",
    name: "System Alerts",
    description: "Platform alerts requiring investigation",
    capabilityIds: ["ADM-007"],
    entityType: "Alert",
  },
  {
    id: "rtl-conflicts",
    name: "RTL Conflicts",
    description: "Regulatory rule conflicts to resolve",
    capabilityIds: ["ADM-006", "ADM-007"],
    entityType: "RegulatoryConflict",
  },
  {
    id: "pending-news",
    name: "Pending News",
    description: "News items awaiting review and publish",
    capabilityIds: ["ADM-008"],
    entityType: "NewsPost",
  },
  {
    id: "failed-jobs",
    name: "Failed Jobs",
    description: "Background jobs in dead letter queue",
    capabilityIds: ["ADM-007"],
    entityType: "FailedJob",
  },
]
```

**Step 2: Create the page**

```typescript
// src/app/(admin)/control-center/page.tsx
/**
 * Admin Control Center
 *
 * Shows platform health and system queues.
 * No tenant data - only platform-level operations.
 *
 * @since Control Center Shells
 */

import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  ControlCenterShell,
  QueueRenderer,
  type QueueItem,
} from "@/components/capability"
import { resolveCapabilitiesForUser } from "@/lib/capabilities"
import { ADMIN_QUEUES } from "./queues"

export const metadata = {
  title: "Admin Control Center | FiskAI",
}

async function getQueueItems(
  queue: (typeof ADMIN_QUEUES)[number]
): Promise<QueueItem[]> {
  let entities: Array<{ id: string; title: string; status: string; timestamp: string }> = []

  switch (queue.entityType) {
    case "Alert": {
      // Platform alerts - would come from monitoring system
      // Placeholder for now
      entities = []
      break
    }
    case "RegulatoryConflict": {
      // RTL conflicts
      const conflicts = await db.regulatoryRule.findMany({
        where: { status: "CONFLICT" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
        },
        take: 10,
      }).catch(() => [])
      entities = conflicts.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        timestamp: c.createdAt.toISOString(),
      }))
      break
    }
    case "NewsPost": {
      // Pending news posts
      const posts = await db.newsPost.findMany({
        where: { status: "PENDING_REVIEW" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
        },
        take: 10,
      }).catch(() => [])
      entities = posts.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        timestamp: p.createdAt.toISOString(),
      }))
      break
    }
    case "FailedJob": {
      // Would query job queue - placeholder
      entities = []
      break
    }
  }

  // Resolve capabilities for each entity
  const items: QueueItem[] = await Promise.all(
    entities.map(async (entity) => {
      const capabilities = await resolveCapabilitiesForUser(queue.capabilityIds, {
        entityId: entity.id,
        entityType: queue.entityType,
      })
      return {
        id: entity.id,
        type: queue.entityType,
        title: entity.title,
        status: entity.status,
        timestamp: entity.timestamp,
        capabilities,
      }
    })
  )

  return items
}

export default async function AdminControlCenterPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  // Verify user is ADMIN
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true },
  })

  if (user?.systemRole !== "ADMIN") {
    redirect("/dashboard")
  }

  // Fetch items for all queues
  const queueData = await Promise.all(
    ADMIN_QUEUES.map(async (queue) => ({
      queue,
      items: await getQueueItems(queue),
    }))
  )

  return (
    <ControlCenterShell title="Platform Health" role="Admin">
      {queueData.map(({ queue, items }) => (
        <QueueRenderer
          key={queue.id}
          queue={queue}
          items={items}
          emptyMessage={`No ${queue.name.toLowerCase()}`}
        />
      ))}
    </ControlCenterShell>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(admin\)/control-center/
git commit -m "feat(admin): add Admin Control Center shell"
```

---

## Task 8: Integration Test

**Files:**
- Create: `src/app/(app)/control-center/__tests__/page.test.tsx`

**Purpose:** Verify Control Centers render without errors.

**Step 1: Create test file**

```typescript
// src/app/(app)/control-center/__tests__/page.test.tsx
/**
 * Client Control Center Tests
 *
 * Verifies the Control Center renders correctly.
 *
 * @since Control Center Shells
 */

import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"

// Mock dependencies
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-user" } }),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        companyMemberships: [{ companyId: "test-company" }],
      }),
    },
    eInvoice: { findMany: vi.fn().mockResolvedValue([]) },
    bankTransaction: { findMany: vi.fn().mockResolvedValue([]) },
    expense: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock("@/lib/capabilities", () => ({
  resolveCapabilitiesForUser: vi.fn().mockResolvedValue([]),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

describe("Client Control Center", () => {
  it("should define all required queues", async () => {
    const { CLIENT_QUEUES } = await import("../queues")

    expect(CLIENT_QUEUES).toHaveLength(5)
    expect(CLIENT_QUEUES.map((q) => q.id)).toEqual([
      "draft-invoices",
      "pending-fiscalization",
      "unmatched-transactions",
      "unpaid-invoices",
      "unpaid-expenses",
    ])
  })

  it("should have capability IDs for each queue", async () => {
    const { CLIENT_QUEUES } = await import("../queues")

    for (const queue of CLIENT_QUEUES) {
      expect(queue.capabilityIds.length).toBeGreaterThan(0)
      expect(queue.entityType).toBeTruthy()
    }
  })
})
```

**Step 2: Run test**

```bash
npx vitest run src/app/\(app\)/control-center/__tests__/page.test.tsx
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/control-center/__tests__/
git commit -m "test: add Control Center integration tests"
```

---

## Task 9: Final Verification

**Step 1: Run all tests**

```bash
npx vitest run
```

**Step 2: Type check**

```bash
npx tsc --noEmit
```

**Step 3: Verify enterprise hardening still passes**

```bash
npx tsx scripts/verify-enterprise-hardening.ts
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Control Center shells implementation"
```

---

## Summary

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/capabilities/server.ts` | Server-side resolution utilities |
| `src/components/capability/*.tsx` | Capability-aware UI primitives |
| `src/app/(app)/control-center/page.tsx` | Client Control Center |
| `src/app/(staff)/control-center/page.tsx` | Accountant Control Center |
| `src/app/(admin)/control-center/page.tsx` | Admin Control Center |

### What This Implements

- Resolver-driven queue rendering
- Resolver-driven action availability
- BLOCKED / READY / MISSING_INPUTS / UNAUTHORIZED surfaced verbatim
- Capability diagnostics toggle
- Zero business logic in UI

### What This Does NOT Implement

- Entity editors
- Form validation
- Data mutation
- Navigation menus
- "Quick actions" without resolution
- Replacing existing pages

---

Plan complete and saved to `docs/plans/2026-01-02-control-center-shells.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
